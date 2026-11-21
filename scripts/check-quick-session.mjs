import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteDatabase } from '../server/database.ts';
import { Service } from '../lib/service.ts';
import { PosService } from '../lib/pos.ts';
import { upgradeManagementSnapshot } from '../lib/replication.ts';
import { DatabaseSync } from 'node:sqlite';

async function fixture(t) {
  const db = new SqliteDatabase(':memory:');
  t.after(() => db.close());
  db.raw.exec("INSERT INTO settings(id,owner,name,timezone) VALUES(1,'owner','Gym','America/La_Paz')");
  const service = new Service(db, { id: 'owner', email: 'admin@example.test', name: 'Admin', role: 'admin' });
  const pos = new PosService(service);
  const product = await pos.saveProduct({
    name: 'Sesión',
    category: 'Sesiones',
    price_cents: 2000,
    track_stock: 0,
    active: 1,
  });
  return { db, service, pos, product };
}

const sell = (pos, product, payment_method = 'cash') =>
  pos.checkout({
    request_id: crypto.randomUUID(),
    payment_method,
    expected_total_cents: product.price_cents,
    lines: [{ kind: 'product', id: product.id, quantity: 1 }],
  });

test('una instalación nueva no ofrece el botón y la elección del producto lo activa', async t => {
  const { service, product } = await fixture(t);
  let data = await service.bootstrap({ compact: true });
  assert.equal(data.settings.quick_session, null);
  assert.equal(data.settings.quick_session_product_id, null);
  assert.equal(data.settings.quick_session_payment_method, 'cash');

  await service.updateSettings({ quick_session_product_id: product.id, quick_session_payment_method: 'transfer' });
  data = await service.bootstrap({ compact: true });
  assert.deepEqual(data.settings.quick_session, {
    product_id: product.id,
    name: 'Sesión',
    price_cents: 2000,
    payment_method: 'transfer',
  });

  await service.updateSettings({ quick_session_product_id: null });
  data = await service.bootstrap({ compact: true });
  assert.equal(data.settings.quick_session, null);
  // Apagar el botón conserva la forma de cobro elegida para cuando se vuelva a activar.
  assert.equal(data.settings.quick_session_payment_method, 'transfer');
});

test('solo se puede elegir un producto activo del catálogo', async t => {
  const { service, pos, product } = await fixture(t);
  await assert.rejects(() => service.updateSettings({ quick_session_product_id: 'inexistente' }), /producto activo/);
  const plan = await pos.savePlan({ name: 'Mensual', unit: 'months', duration: 1, price_cents: 15000 });
  await assert.rejects(() => service.updateSettings({ quick_session_product_id: plan.id }), /producto activo/);
  await assert.rejects(() => service.updateSettings({ quick_session_payment_method: 'cheque' }));

  await service.updateSettings({ quick_session_product_id: product.id });
  // Desactivar el producto esconde el botón sin perder la elección guardada.
  await pos.saveProduct({ name: 'Sesión', category: 'Sesiones', price_cents: 2000, track_stock: 0, active: 0 }, product.id);
  const data = await service.bootstrap({ compact: true });
  assert.equal(data.settings.quick_session, null);
  assert.equal(data.settings.quick_session_product_id, product.id);
  await assert.rejects(() => service.updateSettings({ quick_session_product_id: product.id }), /producto activo/);
});

test('el botón cobra sin socio, suma a la caja y se puede anular', async t => {
  const { service, pos, product } = await fixture(t);
  await service.updateSettings({ quick_session_product_id: product.id, quick_session_payment_method: 'cash' });
  const cashier = new PosService(new Service(service.db, { ...service.actor, role: 'operator' }, service.codec));

  const first = await sell(cashier, product);
  assert.equal(first.person_id, null);
  assert.equal(first.total_cents, 2000);
  assert.equal(first.status, 'paid');
  assert.equal(first.memberships.length, 0);
  assert.deepEqual(
    first.lines.map(line => [line.kind, line.name, line.quantity, line.total_cents]),
    [['product', 'Sesión', 1, 2000]],
  );
  const second = await sell(cashier, product);
  assert.notEqual(second.id, first.id);

  const today = await pos.today();
  const report = await pos.report(new URLSearchParams({ period: 'day', from: today, to: today }));
  assert.equal(report.summary.count, 2);
  assert.equal(report.summary.total_cents, 4000);
  assert.deepEqual(
    report.products.map(item => [item.item_id, item.quantity, item.total_cents]),
    [[product.id, 2, 4000]],
  );
  assert.deepEqual(
    report.by_method.map(method => [method.payment_method, method.count, method.total_cents]),
    [['cash', 2, 4000]],
  );

  const voided = await pos.voidSale(second.id, { reason: 'Se cobró dos veces por error' });
  assert.equal(voided.status, 'void');
  const after = await pos.report(new URLSearchParams({ period: 'day', from: today, to: today }));
  assert.equal(after.summary.count, 1);
  assert.equal(after.summary.total_cents, 2000);
  assert.equal(after.summary.void_count, 1);
});

test('un precio cambiado en el catálogo no se cobra con el importe anterior', async t => {
  const { service, pos, product } = await fixture(t);
  await service.updateSettings({ quick_session_product_id: product.id });
  await pos.saveProduct({ name: 'Sesión', category: 'Sesiones', price_cents: 2500, track_stock: 0, active: 1 }, product.id);
  await assert.rejects(() => sell(pos, product), /precio cambió/);
  const data = await service.bootstrap({ compact: true });
  assert.equal(data.settings.quick_session.price_cents, 2500);
  assert.equal((await sell(pos, { ...product, price_cents: 2500 })).total_cents, 2500);
});

test('las copias sincronizadas anteriores reciben las columnas de la venta rápida', () => {
  const snapshot = {
    protocol: 1,
    tables: [
      {
        name: 'settings',
        columns: [{ name: 'id', type: 'INTEGER', pk: 1 }],
        rows: [{ id: 1 }],
        sql: 'CREATE TABLE settings(id INTEGER PRIMARY KEY CHECK(id=1))',
      },
    ],
    triggers: [],
  };
  const settings = upgradeManagementSnapshot(snapshot).tables[0];
  assert.ok(settings.columns.some(column => column.name === 'quick_session_product_id'));
  // El esquema de la copia también describe las columnas nuevas, para quien recrea la tabla con él.
  assert.match(settings.sql, /quick_session_product_id TEXT REFERENCES pos_products\(id\)/);
  assert.match(settings.sql, /quick_session_payment_method TEXT NOT NULL DEFAULT 'cash'/);
  assert.match(settings.sql, /^CREATE TABLE settings\(.*\)$/);
  const copy = new DatabaseSync(':memory:');
  try {
    copy.exec('CREATE TABLE pos_products(id TEXT PRIMARY KEY)');
    copy.exec(settings.sql);
    copy.prepare('INSERT INTO settings(id) VALUES(1)').run();
    assert.equal(copy.prepare('SELECT quick_session_payment_method m FROM settings').get().m, 'cash');
  } finally {
    copy.close();
  }
  assert.equal(settings.rows[0].quick_session_product_id, null);
  assert.equal(settings.rows[0].quick_session_payment_method, 'cash');
  // Una copia que ya trae la elección conserva su valor.
  const chosen = upgradeManagementSnapshot({
    ...snapshot,
    tables: [
      {
        ...snapshot.tables[0],
        columns: [...snapshot.tables[0].columns, { name: 'quick_session_product_id', type: 'TEXT', pk: 0 }],
        rows: [{ id: 1, quick_session_product_id: 'producto' }],
      },
    ],
  }).tables[0];
  assert.equal(chosen.rows[0].quick_session_product_id, 'producto');
  assert.equal(chosen.rows[0].quick_session_payment_method, 'cash');
});
