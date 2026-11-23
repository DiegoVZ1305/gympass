import test from 'node:test';
import assert from 'node:assert/strict';
import { componentHarness, componentStubs, elementText, findElement } from './component-harness.ts';
import * as exportHelpers from '../src/pos-report-export.ts';
import type { PosReport } from '../lib/pos-types.ts';

const report: PosReport = {
  period: 'month',
  from: '2026-10-01',
  to: '2026-11-22',
  summary: {
    count: 3,
    total_cents: 42000,
    average_cents: 14000,
    void_count: 0,
    void_cents: 0,
    previous: { from: '2026-08-10', to: '2026-09-30', count: 1, total_cents: 18000 },
  },
  series: [
    {
      bucket: '2026-10',
      count: 0,
      total_cents: 0,
      plans: { quantity: 0, total_cents: 0 },
      products: { quantity: 0, total_cents: 0 },
      by_method: [],
    },
    {
      bucket: '2026-11',
      count: 3,
      total_cents: 42000,
      plans: { quantity: 2, total_cents: 36000 },
      products: { quantity: 5, total_cents: 6000 },
      by_method: [
        { payment_method: 'cash', total_cents: 36000, count: 2 },
        { payment_method: 'card', total_cents: 6000, count: 1 },
      ],
    },
  ],
  plans: [{ item_id: 'plan', name: 'Plan mensual', quantity: 2, total_cents: 36000 }],
  products: [{ item_id: 'bebida', name: 'Bebida', quantity: 5, total_cents: 6000 }],
  by_method: [
    { payment_method: 'cash', total_cents: 36000, count: 2 },
    { payment_method: 'card', total_cents: 6000, count: 1 },
  ],
  by_cashier: [{ actor: 'admin@example.test', name: 'Admin', total_cents: 42000, count: 3 }],
};

async function screen(t: { after(fn: () => void): void }) {
  const h = componentHarness();
  t.after(() => h.cleanup());
  const module = h.load('../src/PosReports.tsx', {
    'lucide-react': componentStubs,
    './api': { api: async () => report },
    './PosCharts': { Donut: 'Donut', SplitBar: 'SplitBar', foldParts: (parts: unknown[]) => parts },
    './pos-report-export': exportHelpers,
    './ui': componentStubs,
  });
  h.render(() =>
    module.default({ data: { today: '2026-11-22', settings: { name: 'Gimnasio Demo' } }, notify: () => {} }),
  );
  return { h, module, tree: await h.settle() };
}

const toggle = (tree: unknown, label: string) =>
  findElement(tree, (element) => element.type === 'button' && element.props['aria-label']?.includes(label));

test('cada grupo con ventas se abre y muestra su desglose; el vacío no se puede abrir', async (t) => {
  const { h, tree } = await screen(t);
  assert.throws(() => toggle(tree, 'Octubre 2026'), /no encontrado/i);
  const button = toggle(tree, 'Noviembre 2026');
  assert.equal(button.props['aria-expanded'], false);
  assert.throws(() => findElement(tree, (element) => element.props.className === 'pos-report-detail'));

  button.props.onClick();
  let open = await h.settle();
  assert.equal(toggle(open, 'Noviembre 2026').props['aria-expanded'], true);
  const detail = findElement(open, (element) => element.props.className === 'pos-report-detail');
  assert.equal(findElement(detail, (element) => !!element.props.row).props.row.bucket, '2026-11');

  toggle(open, 'Noviembre 2026').props.onClick();
  open = await h.settle();
  assert.throws(() => findElement(open, (element) => element.props.className === 'pos-report-detail'));
});

test('el desglose dice cuánto fue de planes, cuánto de productos y cómo se pagó', async (t) => {
  const { h, module } = await screen(t);
  const detail = elementText(h.render(() => module.BucketDetail({ row: report.series[1] })));
  for (const part of ['Planes', 'Productos', 'Efectivo', 'Tarjeta', '2 vendidos', '5 vendidos', '2 ventas', '1 venta'])
    assert.ok(detail.includes(part), 'falta en el desglose: ' + part);
  assert.ok(detail.includes('Bs') && detail.includes('360,00'), 'faltan los importes del desglose');
});

test('cambiar la agrupación cierra los desgloses abiertos', async (t) => {
  const { h, tree } = await screen(t);
  toggle(tree, 'Noviembre 2026').props.onClick();
  assert.equal(toggle(await h.settle(), 'Noviembre 2026').props['aria-expanded'], true);
  findElement(await h.settle(), (element) => element.type === 'button' && elementText(element) === 'Año').props.onClick();
  assert.equal(toggle(await h.settle(), 'Noviembre 2026').props['aria-expanded'], false);
});

test('el CSV y el documento para imprimir llevan el mismo desglose que la pantalla', () => {
  const csv = exportHelpers.reportCsv(report);
  assert.ok(csv.includes('"Noviembre 2026 · planes","2","360.00"'));
  assert.ok(csv.includes('Noviembre 2026 · productos'));
  assert.ok(csv.includes('Noviembre 2026 · Efectivo'));
  assert.ok(!csv.includes('Octubre 2026 · planes'), 'un grupo sin ventas no necesita desglose');
  const html = exportHelpers.reportPrintHtml(report, 'Gimnasio Demo');
  assert.ok(html.includes('Cómo se pagó'));
  assert.ok(html.includes('Efectivo: '));
});
