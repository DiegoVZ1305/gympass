import test from 'node:test';
import assert from 'node:assert/strict';
import { componentHarness, componentStubs, elementText, findElement } from './component-harness.ts';

type Harness = ReturnType<typeof componentHarness>;
const quickSession = { product_id: 'product', name: 'Sesión', price_cents: 2000, payment_method: 'cash' as const };

function bootstrap(settings: Record<string, unknown> = {}, user = { role: 'operator' }, extra = {}) {
  return {
    installation_id: 'install',
    owner: false,
    user: { id: 'u1', name: 'Caja', email: 'caja@example.test', ...user },
    settings: { name: 'Gym', timezone: 'America/La_Paz', ...settings },
    zones: [],
    events: [],
    stats: { entries: 0, exits: 0, denied: 0, inside: 0, activePeople: 3 },
    ...extra,
  };
}

class StubNetworkError extends Error {}
class StubHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function dashboard(t: { after(fn: () => void): void }, data: unknown, failure?: Error) {
  const calls: any[] = [];
  const notices: any[] = [];
  const reloads: any[] = [];
  // Comparte Error con el contexto del componente, como ocurre en el navegador.
  const h: Harness = componentHarness({ Error });
  t.after(() => h.cleanup());
  const module = h.load('../src/Dashboard.tsx', {
    'lucide-react': componentStubs,
    './api': {
      api: async (...args: unknown[]) => {
        calls.push(args);
        if (failure) throw failure;
        return { id: 'sale', total_cents: 2000 };
      },
      NetworkError: StubNetworkError,
      HttpError: StubHttpError,
    },
    './browser': { newRequestId: () => 'request-1' },
    './ui': componentStubs,
    './GymPresence': { default: 'GymPresence' },
  });
  const props = {
    data,
    reload: async (topics?: string[]) => {
      reloads.push(topics);
    },
    notify: (message: string, error = false) => notices.push({ message, error }),
  };
  return { h, module, props, calls, notices, reloads };
}

test('el botón de Inicio cobra una sesión sin socio y avisa del cobro', async t => {
  const { h, module, props, calls, notices, reloads } = dashboard(t, bootstrap({ quick_session: quickSession }));
  const tree = h.render(() => module.SellSession(props));
  const button = findElement(tree, element => element.type === 'button');
  assert.match(elementText(button), /Vender sesión/);
  assert.match(elementText(button), /2(?:[.,]00)?/);
  await button.props.onClick();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 2), ['pos/checkout', 'POST']);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), {
    request_id: 'request-1',
    payment_method: 'cash',
    expected_total_cents: 2000,
    lines: [{ kind: 'product', id: 'product', quantity: 1 }],
  });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].error, false);
  assert.match(notices[0].message, /Sesión cobrada/);
  assert.deepEqual(JSON.parse(JSON.stringify(reloads)), [['pos']]);
  // Cada toque es una venta distinta, no un reintento del mismo cobro.
  await findElement(h.render(() => module.SellSession(props)), element => element.type === 'button').props.onClick();
  assert.equal(calls.length, 2);
});

test('un cobro rechazado se avisa como error y no deja el botón bloqueado', async t => {
  const { h, module, props, notices } = dashboard(
    t,
    bootstrap({ quick_session: quickSession }),
    new StubHttpError(409, 'Existencias insuficientes.'),
  );
  const tree = h.render(() => module.SellSession(props));
  await findElement(tree, element => element.type === 'button').props.onClick();
  const settled = await h.settle();
  assert.deepEqual(notices, [{ message: 'Existencias insuficientes.', error: true }]);
  const button = findElement(settled, element => element.type === 'button');
  assert.equal(button.props.disabled, false);
  assert.equal(button.props['data-payment-pending'], undefined);
});

test('una respuesta perdida pide revisar las ventas antes de volver a cobrar', async t => {
  const { h, module, props, notices } = dashboard(
    t,
    bootstrap({ quick_session: quickSession }),
    new StubNetworkError('Sin conexión con el servidor.'),
  );
  await findElement(h.render(() => module.SellSession(props)), element => element.type === 'button').props.onClick();
  await h.settle();
  assert.match(notices[0].message, /Sin conexión con el servidor\. Revisa «Ventas hechas»/);
  assert.equal(notices[0].error, true);
});

test('el botón aparece solo cuando hay sesión configurada y la cuenta puede cobrar', async t => {
  const visible = dashboard(t, bootstrap({ quick_session: quickSession }));
  const header = findElement(visible.h.render(() => visible.module.default(visible.props)), element => element.type === 'PageHeader');
  assert.ok(findElement(header.props.primaryAction, element => element.type === visible.module.SellSession));

  const unset = dashboard(t, bootstrap({ quick_session: null }));
  const withoutSession = findElement(unset.h.render(() => unset.module.default(unset.props)), element => element.type === 'PageHeader');
  assert.throws(() => findElement(withoutSession.props.primaryAction, element => element.type === unset.module.SellSession));

  const viewer = dashboard(t, bootstrap({ quick_session: quickSession }, { role: 'viewer' }));
  const viewerHeader = findElement(viewer.h.render(() => viewer.module.default(viewer.props)), element => element.type === 'PageHeader');
  assert.equal(viewerHeader.props.primaryAction, false);

  const readOnly = dashboard(
    t,
    bootstrap({ quick_session: quickSession }, { role: 'admin' }, { platform: { gym_id: 'g', read_only: true } }),
  );
  const readOnlyHeader = findElement(readOnly.h.render(() => readOnly.module.default(readOnly.props)), element => element.type === 'PageHeader');
  assert.throws(() => findElement(readOnlyHeader.props.primaryAction, element => element.type === readOnly.module.SellSession));
});

function panel(t: { after(fn: () => void): void }, settings: Record<string, unknown>, products: unknown[]) {
  const calls: any[] = [];
  const saves: number[] = [];
  const h: Harness = componentHarness();
  t.after(() => h.cleanup());
  const module = h.load('../src/QuickSession.tsx', {
    './api': {
      api: async (...args: unknown[]) => {
        calls.push(args);
        return args[0] === 'pos/catalog' ? { products, plans: [] } : { ok: true };
      },
    },
    './ui': componentStubs,
  });
  const tree = h.render(() =>
    module.default({
      settings: { name: 'Gym', timezone: 'America/La_Paz', ...settings },
      saved: async () => {
        saves.push(1);
      },
    }),
  );
  return { h, tree, calls, saves };
}

const sessionProduct = { id: 'product', name: 'Sesión', price_cents: 2000, track_stock: 0, active: 1 };

test('la configuración activa la venta de sesión eligiendo un producto del catálogo', async t => {
  const { h, calls, saves } = panel(t, {}, [sessionProduct, { ...sessionProduct, id: 'otro', name: 'Agua', active: 0 }]);
  let tree = await h.settle();
  assert.deepEqual(calls[0].slice(0, 2), ['pos/catalog', 'GET']);
  // Sin activar, el formulario no pide todavía qué producto se cobra.
  assert.throws(() => findElement(tree, element => element.props.label === '¿Qué se cobra?'));
  findElement(tree, element => element.type === 'input' && element.props.type === 'checkbox').props.onChange({
    target: { checked: true },
  });
  tree = await h.settle();
  const select = findElement(tree, element => element.props.label === '¿Qué se cobra?');
  // Un producto desactivado no se ofrece como sesión.
  assert.doesNotMatch(elementText(select), /Agua/);
  findElement(select.props.children, element => element.type === 'select').props.onChange({
    target: { value: 'product' },
  });
  tree = await h.settle();
  findElement(tree, element => element.props.label === '¿Cómo se cobra?');
  findElement(findElement(tree, element => element.props.label === '¿Cómo se cobra?').props.children, element => element.type === 'select')
    .props.onChange({ target: { value: 'transfer' } });
  tree = await h.settle();
  await findElement(tree, element => element.type === 'Form').props.onSubmit(new FormData());
  assert.deepEqual(calls[1].slice(0, 2), ['settings', 'PATCH']);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1][2])), {
    quick_session_product_id: 'product',
    quick_session_payment_method: 'transfer',
  });
  assert.equal(saves.length, 1);
});

test('desactivarla borra el producto guardado y avisa cuando el producto ya no está activo', async t => {
  const stored = { quick_session_product_id: 'product', quick_session_payment_method: 'cash' };
  const { h, calls } = panel(t, stored, [sessionProduct]);
  let tree = await h.settle();
  assert.equal(findElement(tree, element => element.type === 'input' && element.props.type === 'checkbox').props.checked, true);
  findElement(tree, element => element.type === 'input' && element.props.type === 'checkbox').props.onChange({
    target: { checked: false },
  });
  tree = await h.settle();
  await findElement(tree, element => element.type === 'Form').props.onSubmit(new FormData());
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1][2])), {
    quick_session_product_id: null,
    quick_session_payment_method: 'cash',
  });

  const inactive = panel(t, stored, [{ ...sessionProduct, active: 0 }]);
  const tree2 = await inactive.h.settle();
  assert.match(elementText(tree2), /desactivado/);
});
