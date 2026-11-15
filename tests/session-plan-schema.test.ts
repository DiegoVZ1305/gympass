import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SqliteDatabase } from '../server/database.ts';
import { legacySessionPlanTable, upgradeManagementSnapshot, type SyncTable, type SyncSnapshot } from '../lib/replication.ts';

test('el esquema compatible elimina plazos y una copia antigua se amplía sin inventar compras', t => {
  const db = new SqliteDatabase(':memory:'); t.after(() => db.close());
  const table: SyncTable = { name: 'pos_plans', sql: String(db.raw.prepare("SELECT sql FROM sqlite_master WHERE name='pos_plans'").get()!.sql),
    columns: db.raw.prepare('PRAGMA table_info(pos_plans)').all().map((c: any) => ({ name: c.name, type: c.type, pk: c.pk })), rows: [] };
  const legacy = legacySessionPlanTable(table);
  assert.ok(!legacy.sql!.includes('session_period'));
  const check = new DatabaseSync(':memory:'); t.after(() => check.close()); check.exec(legacy.sql!);
  assert.ok(!check.prepare('PRAGMA table_info(pos_plans)').all().some(c => c.name === 'session_period'));
  const upgraded = upgradeManagementSnapshot({ tables: [legacy], triggers: [] } as unknown as SyncSnapshot);
  assert.equal(upgraded.tables[0].columns.length, table.columns.length);
  assert.deepEqual(upgradeManagementSnapshot(upgraded), upgraded);
});
