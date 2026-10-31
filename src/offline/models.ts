import { Model } from '@nozbe/watermelondb';
import { columnName } from '@nozbe/watermelondb/Schema';

export class OfflineCache extends Model {
  static table = 'offline_cache';
  get cacheKey() { return this._getRaw(columnName('cache_key')) as string; }
  set cacheKey(value: string) { this._setRaw(columnName('cache_key'), value); }
  get payload() { return this._getRaw(columnName('payload')) as string; }
  set payload(value: string) { this._setRaw(columnName('payload'), value); }
  get updatedAt() { return this._getRaw(columnName('updated_at')) as number; }
  set updatedAt(value: number) { this._setRaw(columnName('updated_at'), value); }
}

export class PendingOperation extends Model {
  static table = 'pending_operations';
  get operationType() { return this._getRaw(columnName('operation_type')) as string; }
  set operationType(value: string) { this._setRaw(columnName('operation_type'), value); }
  get payload() { return this._getRaw(columnName('payload')) as string; }
  set payload(value: string) { this._setRaw(columnName('payload'), value); }
  get operatorId() { return this._getRaw(columnName('operator_id')) as string; }
  set operatorId(value: string) { this._setRaw(columnName('operator_id'), value); }
  get operatorName() { return this._getRaw(columnName('operator_name')) as string; }
  set operatorName(value: string) { this._setRaw(columnName('operator_name'), value); }
  get occurredAt() { return this._getRaw(columnName('occurred_at')) as number; }
  set occurredAt(value: number) { this._setRaw(columnName('occurred_at'), value); }
  get status() { return this._getRaw(columnName('status')) as string; }
  set status(value: string) { this._setRaw(columnName('status'), value); }
  get lastError() { return this._getRaw(columnName('last_error')) as string; }
  set lastError(value: string) { this._setRaw(columnName('last_error'), value); }
}
