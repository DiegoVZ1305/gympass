import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SqliteDatabase } from '../server/database.ts';
import { Service } from '../lib/service.ts';
import { PosService } from '../lib/pos.ts';
import { defaultSessionUntil } from '../lib/pos-types.ts';

async function fixture(t: test.TestContext) {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-14T16:00:00Z') });
  const db = new SqliteDatabase(':memory:');
  t.after(() => db.close());
  db.raw.exec("INSERT INTO settings(id,owner,name,timezone) VALUES(1,'owner','Gym','America/La_Paz')");
  const service = new Service(db, { id: 'owner', email: 'admin@example.test', name: 'Admin', role: 'admin' });
  const pos = new PosService(service);
  const person = await service.savePerson({ name: 'Ana Pérez', document: 'CI-15', kind: 'member', status: 'active', phone: '59171234567' });
  const plan = await pos.savePlan({ name: '15 sesiones', unit: 'sessions', duration: 15, price_cents: 15000 });
  const sell = (extra = {}) => pos.checkout({ request_id: randomUUID(), person_id: person.id, payment_method: 'cash', lines: [{ kind: 'plan', id: plan.id, quantity: 1 }], ...extra });
  const scan = (at: string, direction = 'entry') => service.access({ request_id: randomUUID(), person_id: person.id, direction, reason: 'Prueba de sesiones' }, undefined, new Date(at));
  return { db, service, pos, person, plan, sell, scan };
}

test('sesiones: exige una fecha válida sin registrar cobros al faltar o preceder al inicio', async t => {
  const { sell, db } = await fixture(t);
  for (const extra of [{}, { sessions_until: '2026-11-13' }, { sessions_until: '2026-02-30' }])
    await assert.rejects(sell(extra));
  assert.equal(db.raw.prepare('SELECT COUNT(*) n FROM pos_sales').get()!.n, 0);
  assert.equal(defaultSessionUntil('2026-11-14'), '2026-12-13');
  assert.equal(defaultSessionUntil('2026-01-31'), '2026-02-27');
});

test('sesiones: incluye el último día local y bloquea después sin descontar sesiones', async t => {
  const { sell, scan, db, service, pos, person } = await fixture(t);
  const sale = await sell({ sessions_until: '2026-12-13' });
  const membership = sale.memberships[0];
  assert.equal(membership.end_date, '2026-12-14');
  assert.equal((await service.personSummary(person.id)).expires, '2026-12-13');
  assert.equal((await scan('2026-12-14T03:59:59Z')).allowed, 1);
  assert.equal((await scan('2026-12-14T04:00:00Z', 'exit')).allowed, 1);
  assert.equal((await scan('2026-12-14T04:00:01Z')).allowed, 0);
  assert.equal(db.raw.prepare('SELECT sessions_remaining n FROM pos_memberships WHERE id=?').get(membership.id)!.n, 14);
  t.mock.timers.setTime(Date.parse('2026-12-14T16:00:00Z'));
  assert.equal((await service.personSummary(person.id)).sessions_remaining, 0);
  assert.equal((await pos.memberships(person.id)).valid, false);
  assert.equal((await pos.planGate(person.id, '2026-12-14')).state, 'free');
  // El trigger también permite renovar aunque queden sesiones del paquete vencido.
  const renewal = await sell({ sessions_until: '2027-01-13' });
  assert.equal(renewal.memberships[0].sessions_remaining, 15);
});

test('sesiones: agotarlas antes de la fecha límite bloquea el acceso y permite otro plan', async t => {
  const { sell, scan, db, pos, person } = await fixture(t);
  const sale = await sell({ sessions_until: '2026-12-13' });
  db.raw.prepare('UPDATE pos_memberships SET sessions_remaining=1 WHERE id=?').run(sale.memberships[0].id);
  assert.equal((await scan('2026-11-14T16:00:00Z')).allowed, 1);
  await scan('2026-11-14T16:01:00Z', 'exit');
  assert.equal((await scan('2026-11-14T16:02:00Z')).reason, 'SESSIONS_EXHAUSTED');
  assert.equal((await pos.memberships(person.id)).valid, false);
  assert.equal((await pos.planGate(person.id, '2026-11-14')).state, 'free');
});

test('sesiones: reintentar conserva el cobro y cambiar la fecha exige otra solicitud', async t => {
  const { sell, db } = await fixture(t);
  const request_id = randomUUID();
  const first = await sell({ request_id, sessions_until: '2026-12-13' });
  assert.equal((await sell({ request_id, sessions_until: '2026-12-13' })).id, first.id);
  await assert.rejects(sell({ request_id, sessions_until: '2026-12-14' }), /identificador/);
  assert.equal(db.raw.prepare('SELECT COUNT(*) n FROM pos_sales').get()!.n, 1);
});
