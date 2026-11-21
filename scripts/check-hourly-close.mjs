import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteDatabase } from '../server/database.ts';
import { Service, presenceSql } from '../lib/service.ts';
import { sessionMaintenance } from '../server/maintenance.ts';
import { startPlatform } from '../server/platform.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PosService } from '../lib/pos.ts';

const hour = 3600000;

test('los gimnasios nuevos y existentes activan el cierre diario a las 23:59 sin perder datos', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'gympass-daily-migration-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'gym.sqlite');
  let db = new SqliteDatabase(file);
  db.raw.exec("INSERT INTO settings(id,owner,name,timezone) VALUES(1,'owner','Conservado','America/La_Paz')");
  assert.equal(db.raw.prepare('SELECT closing_time FROM settings').get().closing_time, '23:59');
  db.raw.exec("UPDATE settings SET closing_time=NULL; DROP TRIGGER settings_default_daily_closing; ALTER TABLE settings DROP COLUMN quick_session_product_id; ALTER TABLE settings DROP COLUMN quick_session_payment_method; DELETE FROM schema_version WHERE version>=28");
  db.close();
  db = new SqliteDatabase(file);
  try {
    assert.deepEqual({ ...db.raw.prepare('SELECT name,closing_time FROM settings').get() }, { name: 'Conservado', closing_time: '23:59' });
  } finally { db.close(); }
});

test('a las 23:59 salen todos los presentes, conserva salidas reales y no consume sesiones', async t => {
  const { db, service } = await fixture(t);
  await service.updateSettings({ closing_time: '23:59' });
  const pos = new PosService(service);
  const person = await service.savePerson({ name: 'Sesiones al cierre', document: 'DAILY', kind: 'member', status: 'active', phone: '59171234567' });
  const plan = await pos.savePlan({ name: 'Quince sesiones', unit: 'sessions', duration: 15, price_cents: 10000 });
  const sale = await pos.checkout({ person_id: person.id, start_date: '2020-01-01', sessions_until: '2099-12-31', request_id: crypto.randomUUID(), payment_method: 'cash', lines: [{ kind: 'plan', id: plan.id, quantity: 1 }] });
  const employee = await service.savePerson({ name: 'Empleado al cierre', document: 'DAILY-E', kind: 'employee', status: 'active' });
  const gone = await service.savePerson({ name: 'Ya salió', document: 'DAILY-G', kind: 'employee', status: 'active' });
  const entry = Date.parse('2026-11-15T22:00:00-04:00');
  for (const id of [person.id, employee.id, gone.id])
    await service.access({ person_id: id, zone_id: 'general', direction: 'entry', reason: 'Prueba diaria', request_id: crypto.randomUUID() }, undefined, new Date(entry));
  await service.access({ person_id: gone.id, zone_id: 'general', direction: 'exit', reason: 'Salida real', request_id: crypto.randomUUID() }, undefined, new Date(entry + 60000));
  const closing = Date.parse('2026-11-15T23:59:00-04:00');
  assert.equal((await service.closeStaleSessions(new Date(closing - 1))).closed, 0);
  assert.equal((await service.closeStaleSessions(new Date(closing))).closed, 2);
  assert.equal((await service.all(presenceSql)).length, 0);
  const exits = await service.all("SELECT * FROM events WHERE reason='AUTO_CLOSE'");
  assert.equal(exits.length, 2);
  assert.ok(exits.every(row => row.occurred_at === closing && row.direction === 'exit' && row.method === 'system'));
  assert.equal(db.raw.prepare('SELECT sessions_remaining FROM pos_memberships WHERE id=?').get(sale.memberships[0].id).sessions_remaining, 14);
  assert.equal((await service.closeStaleSessions(new Date(closing + 60000))).closed, 0);
  const next = await service.access({ person_id: person.id, direction: 'auto', reason: 'Siguiente día', request_id: crypto.randomUUID() }, undefined, new Date('2026-11-16T08:00:00-04:00'));
  assert.equal(next.direction, 'entry');
  assert.equal(next.allowed, 1);
});

test('el cierre recuperado registra las 23:59 del día de entrada aunque el equipo vuelva días después', async t => {
  const { service, scan, exits } = await fixture(t);
  await service.updateSettings({ closing_time: '23:59' });
  await scan('2026-11-12T18:00:00-04:00');
  assert.equal((await service.closeStaleSessions(new Date('2026-11-15T10:00:00-04:00'))).closed, 1);
  assert.equal((await exits())[0].occurred_at, Date.parse('2026-11-12T23:59:00-04:00'));
  assert.equal((await service.closeStaleSessions(new Date('2026-11-15T11:00:00-04:00'))).closed, 0);
});

test('el panel ya en la cola puede comprobar cierres aunque el temporizador esté esperando detrás', async () => {
  const db = new SqliteDatabase(':memory:');
  db.raw.exec("INSERT INTO settings(id,owner,name,timezone) VALUES(1,'owner','Gym','America/La_Paz')");
  let tail = Promise.resolve();
  const exclusive = operation => { const work = tail.catch(() => {}).then(operation); tail = work; return work; };
  const maintenance = sessionMaintenance(db, () => new Date('2026-11-09T12:00:00Z'), exclusive);
  let queued, timer;
  try {
    await exclusive(async () => {
      queued = maintenance.check();
      const result = await Promise.race([maintenance.check(true), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('El cierre automático esperó a su propia cola.')), 1000); })]);
      assert.equal(result.closed, 0);
      assert.equal(maintenance.check(), queued);
    });
    assert.equal((await queued).closed, 0);
  } finally { clearTimeout(timer); await queued; maintenance.stop(); db.close(); }
});
async function fixture(t, hours = 2) {
  const db = new SqliteDatabase(':memory:');
  t.after(() => db.close());
  db.raw.exec("INSERT INTO settings(id,owner,name,timezone) VALUES(1,'owner','Gym','America/La_Paz')");
  const service = new Service(db, { id: 'owner', email: 'admin@example.test', name: 'Admin', role: 'admin' });
  await service.updateSettings({ auto_close_hours: hours, closing_time: null });
  const person = await service.savePerson({ name: 'Ana', document: 'HOURLY', kind: 'employee', status: 'active', zone_ids: ['general'] });
  const operator = new Service(db, { ...service.actor, role: 'operator' });
  const scan = (at, request_id = crypto.randomUUID()) => operator.access({ person_id: person.id, zone_id: 'general', direction: 'auto', reason: 'Prueba de cierre', request_id }, undefined, new Date(at));
  const exits = () => service.all("SELECT * FROM events WHERE reason='AUTO_CLOSE' ORDER BY id");
  return { db, service, operator, scan, exits };
}

test('el mantenimiento por horas vuelve a comprobar durante el mismo día y cierra en el límite exacto', async t => {
  const { db, scan, exits } = await fixture(t);
  const entry = Date.parse('2026-11-08T12:00:00Z');
  await scan(entry);
  let now = entry + hour;
  const maintenance = sessionMaintenance(db, () => new Date(now));
  t.after(() => maintenance.stop());
  assert.equal((await maintenance.check()).closed, 0);
  now = entry + 2 * hour;
  assert.equal((await maintenance.check()).closed, 1);
  assert.equal((await exits())[0].occurred_at, now);
  assert.equal((await maintenance.check()).closed, 0);
});

test('una lectura automática aplica el cierre por horas antes de decidir el movimiento y conserva reintentos', async t => {
  const { scan, exits } = await fixture(t);
  const entry = Date.parse('2026-11-08T12:00:00Z');
  assert.equal((await scan(entry)).direction, 'entry');
  const id = crypto.randomUUID();
  const next = await scan(entry + 3 * hour, id);
  assert.equal(next.direction, 'entry');
  assert.equal((await scan(entry + 3 * hour + 60000, id)).id, next.id);
  assert.equal((await exits()).length, 1);
  assert.equal((await exits())[0].occurred_at, entry + 2 * hour);
});

test('abrir recepción recupera las visitas olvidadas aunque el temporizador no haya corrido', async t => {
  const { operator, scan, exits } = await fixture(t);
  const entry = Date.now() - 3 * hour;
  await scan(entry);
  const boot = await operator.bootstrap({ compact: true, maintain: true });
  assert.equal(boot.stats.inside, 0);
  assert.equal((await exits())[0].occurred_at, entry + 2 * hour);
  assert.equal((await operator.bootstrap({ compact: true, maintain: true })).stats.inside, 0);
  assert.equal((await exits()).length, 1);
});

test('el cierre por horas recupera visitas de ayer, respeta salidas reales y puede desactivarse', async t => {
  const { service, scan, exits } = await fixture(t);
  const entry = Date.parse('2026-11-07T12:00:00Z');
  await scan(entry);
  await service.updateSettings({ auto_close_hours: 0 });
  assert.equal((await service.closeStaleSessions(new Date(entry + 24 * hour))).closed, 0);
  await service.updateSettings({ auto_close_hours: 2 });
  assert.equal((await service.closeStaleSessions(new Date(entry + 24 * hour))).closed, 1);
  assert.equal((await exits())[0].occurred_at, entry + 2 * hour);
  await scan(entry + 24 * hour);
  await scan(entry + 25 * hour);
  assert.equal((await service.closeStaleSessions(new Date(entry + 48 * hour))).closed, 0);
  assert.equal((await service.all(presenceSql)).length, 0);
});

test('el bootstrap HTTP actualiza los presentes sin esperar al temporizador del servidor', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'gympass-hourly-http-'));
  const app = await startPlatform({ dataDirectory: directory, port: 0, allowHttp: true });
  try {
    const owner = await app.store.bootstrap({ name: 'Owner', email: 'owner@example.test', password: '123456' });
    const gym = app.store.createGym(owner, { name: 'Cierre por horas', slug: 'hourly' });
    app.tenants.provision(gym);
    app.store.markGymProvisioned(gym.id);
    const member = await app.store.createMember(owner, gym.id, { name: 'Recepción', email: 'admin@example.test', password: '123456', role: 'admin' });
    const login = await app.store.login({ email: 'admin@example.test', password: '123456' });
    await app.tenants.withTenant(gym, async ctx => {
      const service = new Service(ctx.db, member, ctx.codec);
      const person = await service.savePerson({ name: 'Visita de ayer', document: 'HTTP', kind: 'employee', status: 'active', zone_ids: ['general'] });
      await service.updateSettings({ auto_close_hours: 2, closing_time: null });
      await service.access({ person_id: person.id, zone_id: 'general', direction: 'entry', reason: 'Visita olvidada', request_id: crypto.randomUUID() }, undefined, new Date(Date.now() - 24 * hour));
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(app.url + `/api/gyms/${gym.id}/bootstrap?compact=1`, { headers: { Cookie: `gympass_platform=${login.token}` } });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).stats.inside, 0);
    }
    await app.tenants.withTenant(gym, async ctx => {
      assert.equal(ctx.db.raw.prepare("SELECT COUNT(*) n FROM events WHERE reason='AUTO_CLOSE'").get().n, 1);
    });
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
