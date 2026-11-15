import test from 'node:test';
import assert from 'node:assert/strict';
import { componentHarness, componentStubs, findElement, elementText } from './component-harness.ts';

test('crear un plan por sesiones pide cantidad y plazo por separado y los envía al guardar', async t => {
  const h = componentHarness(); t.after(() => h.cleanup());
  let saved: any;
  const { CatalogEditor } = h.load('../src/Pos.tsx', {
    'react-dom': { createPortal: (value: unknown) => value }, 'lucide-react': componentStubs,
    './api': { api: async (_path: string, _method: string, body: any) => { saved = body; return { id: 'plan' }; } },
    './usePeople': {}, './browser': {}, './PersonMemberships': { default: 'PersonMemberships' }, './PosReports': { default: 'PosReports' },
    './ShareCredentialButton': { default: 'ShareCredentialButton' }, './ui': componentStubs, './styles/pos.css': {},
  });
  let tree = h.render(() => CatalogEditor({ kind: 'plan', onClose() {}, onSaved: async () => {} }));
  findElement(tree, e => e.type === 'select' && e.props.name === 'unit').props.onChange({ target: { value: 'sessions' } });
  tree = await h.settle();
  assert.match(findElement(tree, e => e.props.label === 'Plazo para completar las sesiones').props.hint, /15 sesiones para completar en 1 mes/);
  assert.ok(findElement(tree, e => e.props.label === 'Cantidad de sesiones'));
  assert.equal(findElement(tree, e => e.type === 'input' && e.props.name === 'session_period').props.required, true);
  const form = new FormData();
  for (const [name, value] of Object.entries({ name: '15 sesiones', unit: 'sessions', duration: '15', session_period_unit: 'months', session_period: '1', price: '150', active: '1' })) form.set(name, value);
  await findElement(tree, e => e.type === 'Form').props.onSubmit(form);
  assert.equal(saved.duration, 15); assert.equal(saved.session_period, 1); assert.equal(saved.session_period_unit, 'months');
});
