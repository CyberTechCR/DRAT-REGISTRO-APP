import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { confirmManualMovement, confirmNfcMovement } from '@/services/api';
import { pendingCount, pendingOperations, updatePendingOperation } from './storage';

type OfflineContextValue = { isOnline: boolean; pending: number; syncing: boolean; refreshPending: () => Promise<void>; syncNow: (token?: string) => Promise<void> };
const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: PropsWithChildren) {
  const [isOnline, setIsOnline] = useState(true); const [pending, setPending] = useState(0); const [syncing, setSyncing] = useState(false);
  const refreshPending = useCallback(async () => setPending(await pendingCount()), []);
  const syncNow = useCallback(async (token?: string) => {
    if (!token || syncing) return;
    setSyncing(true);
    try {
      for (const item of await pendingOperations()) {
        try {
          const payload = JSON.parse(item.payload);
          if (item.operationType === 'EMPLOYEE_MANUAL') await confirmManualMovement(token, payload.employeeId, payload.movementType, payload.reason);
          if (item.operationType === 'EMPLOYEE_NFC') await confirmNfcMovement(token, payload.code, payload.movementType, payload.source);
          await updatePendingOperation(item, 'SINCRONIZADO');
        } catch (cause) { await updatePendingOperation(item, 'PENDIENTE', cause instanceof Error ? cause.message : 'Error de sincronización'); }
      }
    } finally { setSyncing(false); await refreshPending(); }
  }, [refreshPending, syncing]);
  useEffect(() => { void Promise.resolve().then(refreshPending); return NetInfo.addEventListener((state) => setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false))); }, [refreshPending]);
  const value = useMemo(() => ({ isOnline, pending, syncing, refreshPending, syncNow }), [isOnline, pending, refreshPending, syncNow, syncing]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() { const value = useContext(OfflineContext); if (!value) throw new Error('useOffline requiere OfflineProvider'); return value; }
