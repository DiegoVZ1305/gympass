import test from 'node:test';
import assert from 'node:assert/strict';
import { componentHarness, componentStubs, elementText, findElement } from './component-harness.ts';

test('soporte abre ambos chats con los números correctos y la versión, y permite cerrar el diálogo', async t => {
  const h = componentHarness(); t.after(() => h.cleanup());
  const { default: Support } = h.load('../src/Support.tsx', {
    'react-dom': { createPortal: (tree: unknown) => tree }, 'lucide-react': componentStubs,
    './ui': { Modal: 'Modal' }, './styles/support.css': {},
  });
  let tree = h.render(() => Support({ version: '5.5.1' }));
  const button = () => findElement(tree, e => e.type === 'button' && e.props['aria-label'] === 'Soporte por WhatsApp');
  assert.equal(button().props['aria-expanded'], false);
  assert.throws(() => findElement(tree, e => e.type === 'Modal'));
  button().props.onClick(); tree = await h.settle();
  assert.equal(button().props['aria-expanded'], true);
  for (const [name, phone] of [['Técnico 1', '59162629717'], ['Técnico 2', '59176738942']]) {
    const contact = findElement(tree, e => e.type === 'a' && e.props['aria-label'] === `Escribir a ${name} por WhatsApp`);
    const url = new URL(contact.props.href);
    assert.equal(url.origin, 'https://wa.me'); assert.equal(url.pathname, '/' + phone);
    assert.match(url.searchParams.get('text')!, /GymPASS 5\.5\.1/);
    assert.match(url.searchParams.get('text')!, /problema con la aplicación/);
    assert.equal(contact.props.target, '_blank'); assert.match(contact.props.rel, /noopener/);
    assert.ok(elementText(contact).includes(name));
  }
  findElement(tree, e => e.type === 'Modal').props.onClose(); tree = await h.settle();
  assert.equal(button().props['aria-expanded'], false);
  assert.throws(() => findElement(tree, e => e.type === 'Modal'));
});

test('el enlace de soporte también funciona sin una versión disponible', () => {
  const h = componentHarness();
  const { supportWhatsappUrl } = h.load('../src/Support.tsx', {
    'react-dom': {}, 'lucide-react': componentStubs, './ui': {}, './styles/support.css': {},
  });
  const url = new URL(supportWhatsappUrl('59176738942'));
  assert.equal(url.pathname, '/59176738942');
  assert.equal(url.searchParams.get('text'), 'Hola, necesito ayuda con GymPASS. Tengo un problema con la aplicación.');
});
