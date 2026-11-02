import { Q } from '@nozbe/watermelondb';
import type { SessionUser } from '@/auth/SessionContext';
import type { Employee, EmergencyPresenceRecord, ManualMovementResolution, NfcMovementResolution } from '@/services/api';
import { offlineDatabase } from './database';
import { OfflineCache, PendingOperation } from './models';

export async function saveCache(key: string, value: unknown) {
  const collection = offlineDatabase.get<OfflineCache>('offline_cache');
  const current = await collection.query(Q.where('cache_key', key)).fetch();
  await offlineDatabase.write(async () => {
    if (current[0]) await current[0].update((record) => { record.payload = JSON.stringify(value); record.updatedAt = Date.now(); });
    else await collection.create((record) => { record.cacheKey = key; record.payload = JSON.stringify(value); record.updatedAt = Date.now(); });
  });
}

export async function readCache<T>(key: string): Promise<T | null> {
  const rows = await offlineDatabase.get<OfflineCache>('offline_cache').query(Q.where('cache_key', key)).fetch();
  return rows[0] ? JSON.parse(rows[0].payload) as T : null;
}

export async function removeCache(key: string) {
  const rows = await offlineDatabase.get<OfflineCache>('offline_cache').query(Q.where('cache_key', key)).fetch();
  await offlineDatabase.write(async () => Promise.all(rows.map((record) => record.destroyPermanently())));
}

export async function enqueueOperation(operationType: string, payload: unknown, operator: SessionUser) {
  await offlineDatabase.write(async () => offlineDatabase.get<PendingOperation>('pending_operations').create((record) => {
    record.operationType = operationType; record.payload = JSON.stringify(payload);
    record.operatorId = operator.id; record.operatorName = operator.name;
    record.occurredAt = Date.now(); record.status = 'PENDIENTE'; record.lastError = '';
  }));
}

export async function pendingCount() {
  return offlineDatabase.get<PendingOperation>('pending_operations').query(Q.where('status', 'PENDIENTE')).fetchCount();
}

export async function conflictOperations() {
  return offlineDatabase.get<PendingOperation>('pending_operations').query(Q.where('status', 'CONFLICTO'), Q.sortBy('occurred_at', Q.desc)).fetch();
}

export async function pendingOperations() {
  return offlineDatabase.get<PendingOperation>('pending_operations').query(Q.where('status', 'PENDIENTE'), Q.sortBy('occurred_at', Q.asc)).fetch();
}

export async function updatePendingOperation(record: PendingOperation, status: string, lastError = '') {
  await offlineDatabase.write(async () => record.update((item) => { item.status = status; item.lastError = lastError; }));
}

export async function applyOfflineEmployeeMovement(employee: Employee, movementType: 'INGRESO' | 'SALIDA', resolutionKey: string, previous: ManualMovementResolution | NfcMovementResolution) {
  const occurredAt = new Date().toISOString();
  const nextMovement = movementType === 'INGRESO' ? 'SALIDA' : 'INGRESO';
  await saveCache(resolutionKey, { ...previous, proposedMovement: nextMovement, lastMovement: { movementType, occurredAt } });
  const presence = await readCache<EmergencyPresenceRecord[]>('emergency-presence') ?? [];
  const withoutEmployee = presence.filter((item) => !(item.kind === 'FUNCIONARIO' && item.id === employee.id));
  if (movementType === 'INGRESO') withoutEmployee.push({ id: employee.id, kind: 'FUNCIONARIO', name: employee.name, identification: employee.identification, detail: `${employee.department} · ${employee.position}`, enteredAt: occurredAt });
  await saveCache('emergency-presence', withoutEmployee);
}
