import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useSession } from '@/auth/SessionContext';
import { ApiRequestError, confirmManualMovement, confirmNfcMovement } from '@/services/api';
import { conflictOperations, pendingCount, pendingOperations, readCache, saveCache, updatePendingOperation } from './storage';

export type SyncConflict = { id: string; operationType: string; occurredAt: number; operatorName: string; error: string };
type OfflineContextValue = {
  isOnline: boolean; pending: number; syncing: boolean; conflicts: SyncConflict[]; lastSuccessfulSync: string | null;
  refreshPending: () => Promise<void>; syncNow: (token?: string) => Promise<void>;
};
const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const [isOnline, setIsOnline] = useState(true); const [pending, setPending] = useState(0); const [syncing, setSyncing] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]); const [lastSuccessfulSync, setLastSuccessfulSync] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const refreshPending = useCallback(async () => {
    const [nextPending, conflictRecords, lastSync] = await Promise.all([pendingCount(), conflictOperations(), readCache<string>('last-successful-sync')]);
    setPending(nextPending); setConflicts(conflictRecords.map((item) => ({ id: item.id, operationType: item.operationType, occurredAt: item.occurredAt, operatorName: item.operatorName, error: item.lastError }))); setLastSuccessfulSync(lastSync);
  }, []);
  const syncNow = useCallback(async (providedToken?: string) => {
    const token = providedToken ?? session?.token;
    if (!token || syncingRef.current) return;
    syncingRef.current = true; setSyncing(true); let retryableFailure = false;
    try {
      for (const item of await pendingOperations()) {
        try {
          const payload = JSON.parse(item.payload); const metadata = { clientOperationId: item.id, clientOccurredAt: new Date(item.occurredAt).toISOString() };
          if (item.operationType === 'EMPLOYEE_MANUAL') await confirmManualMovement(token, payload.employeeId, payload.movementType, payload.reason, metadata);
          else if (item.operationType === 'EMPLOYEE_NFC') await confirmNfcMovement(token, payload.code, payload.movementType, payload.source, metadata);
          else throw new ApiRequestError('Tipo de operación local no reconocido', undefined, 400);
          await updatePendingOperation(item, 'SINCRONIZADO');
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Error de sincronización';
          if (cause instanceof ApiRequestError && cause.status >= 400 && cause.status < 500) await updatePendingOperation(item, 'CONFLICTO', message);
          else { retryableFailure = true; await updatePendingOperation(item, 'PENDIENTE', message); }
        }
      }
      if (!retryableFailure) { const timestamp = new Date().toISOString(); await saveCache('last-successful-sync', timestamp); setLastSuccessfulSync(timestamp); }
    } finally { syncingRef.current = false; setSyncing(false); await refreshPending(); }
  }, [refreshPending, session?.token]);
  useEffect(() => { void Promise.resolve().then(refreshPending); return NetInfo.addEventListener((state) => setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false))); }, [refreshPending]);
  useEffect(() => { if (isOnline && session?.token) void syncNow(session.token); }, [isOnline, session?.token, syncNow]);
  const value = useMemo(() => ({ isOnline, pending, syncing, conflicts, lastSuccessfulSync, refreshPending, syncNow }), [conflicts, isOnline, lastSuccessfulSync, pending, refreshPending, syncNow, syncing]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() { const value = useContext(OfflineContext); if (!value) throw new Error('useOffline requiere OfflineProvider'); return value; }
