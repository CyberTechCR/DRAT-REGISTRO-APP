import { appSchema, Database, tableSchema } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { OfflineCache, PendingOperation } from './models';

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'offline_cache',
      columns: [
        { name: 'cache_key', type: 'string', isIndexed: true },
        { name: 'payload', type: 'string' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'pending_operations',
      columns: [
        { name: 'operation_type', type: 'string', isIndexed: true },
        { name: 'payload', type: 'string' },
        { name: 'operator_id', type: 'string' },
        { name: 'operator_name', type: 'string' },
        { name: 'occurred_at', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'last_error', type: 'string' },
      ],
    }),
  ],
});

const adapter = new SQLiteAdapter({ schema, dbName: 'sicaf_offline', jsi: false, onSetUpError: console.error });
export const offlineDatabase = new Database({ adapter, modelClasses: [OfflineCache, PendingOperation] });
