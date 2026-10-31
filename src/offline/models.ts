import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export class OfflineCache extends Model {
  static table = 'offline_cache';
  @text('cache_key') cacheKey!: string;
  @text('payload') payload!: string;
  @field('updated_at') updatedAt!: number;
}

export class PendingOperation extends Model {
  static table = 'pending_operations';
  @text('operation_type') operationType!: string;
  @text('payload') payload!: string;
  @text('operator_id') operatorId!: string;
  @text('operator_name') operatorName!: string;
  @field('occurred_at') occurredAt!: number;
  @text('status') status!: string;
  @text('last_error') lastError!: string;
}
