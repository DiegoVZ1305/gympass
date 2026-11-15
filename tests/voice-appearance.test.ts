import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultVoiceSettings, recordedAccessVoice, type VoiceSettings } from '../lib/access-feedback.ts';
import { componentHarness, elementText, findElement } from './component-harness.ts';

test('Sonidos ofrece exactamente voz con nombre, grabaciones y beeps y guarda al confirmar', async t => {
  const h = componentHarness(); t.after(() => h.cleanup());
  const preferences = { ...defaultVoiceSettings, sound: true, vibration: false };
  const calls: { allowed: boolean; voice: string; name: string }[] = [];
  const { default: Sounds } = h.load('../src/AccessSounds.tsx', {
    './preferences': { usePreferences: () => preferences, updatePreferences: (change: any) => { Object.assign(preferences, change); return true; } },
    './feedback': { prepareAudio() {}, prepareAccessVoice() {}, stopFeedback() {}, accessFeedback: async (allowed: boolean, _sound: boolean, _vibration: boolean, _direction: string, name: string, options: any) => { calls.push({ allowed, voice: options.voiceURI, name }); return options.voiceURI === 'tone:beep' ? 'tone' : 'device'; } },
    './ui': { Field: 'Field' }, './styles/appearance.css': {},
  });
  let tree = h.render(Sounds);
  const picker = () => findElement(tree, e => e.type === 'Field' && e.props.label === 'Tipo de aviso').props.children;
  assert.deepEqual(Array.from(picker().props.children, (e: any) => e.props.value), ['', recordedAccessVoice, 'tone:beep']);
  assert.throws(() => findElement(tree, e => e.type === 'optgroup'));
  findElement(tree, e => e.type === 'button' && elementText(e) === 'Probar acceso denegado').props.onClick();
  tree = await h.settle();
  assert.equal(calls[0].allowed, false);
  assert.equal(calls[0].name, 'María Pérez');
  picker().props.onChange({ target: { value: 'tone:beep' } }); tree = await h.settle();
  assert.equal(preferences.voiceURI, '');
  assert.throws(() => findElement(tree, e => e.type === 'input' && e.props.type === 'range'));
  findElement(tree, e => e.type === 'button' && elementText(e) === 'Probar acceso permitido').props.onClick(); tree = await h.settle();
  assert.equal(calls[1].voice, 'tone:beep');
  findElement(tree, e => e.type === 'button' && elementText(e) === 'Guardar cambios').props.onClick(); tree = await h.settle();
  assert.equal(preferences.voiceURI, 'tone:beep');
});

test('Avisos y sonidos permite probar las grabaciones y oculta ajustes que sólo afectan a las voces', async t => {
  const h = componentHarness(); t.after(() => h.cleanup());
  const calls: string[] = [];
  const { default: AccessSounds } = h.load('../src/AccessSounds.tsx', {
    './preferences': {
      usePreferences: () => ({ ...defaultVoiceSettings, voiceURI: recordedAccessVoice, theme: 'light', density: 'comfortable', sound: true, vibration: false }),
      updatePreferences() {},
    },
    './feedback': {
      subscribeAccessVoices: () => () => {}, prepareAudio() {}, prepareAccessVoice() {}, stopFeedback() {},
      accessFeedback: async (allowed: boolean, _sound: boolean, _vibration: boolean, _direction: string, _name: string, settings: VoiceSettings) => {
        assert.equal(settings.voiceURI, recordedAccessVoice);
        calls.push(allowed ? 'allowed' : 'denied'); return 'recorded';
      },
    },
    './ui': { Field: 'Field' }, './styles/appearance.css': {},
  });
  let tree = h.render(AccessSounds);
  const picker = findElement(tree, e => e.type === 'Field' && e.props.label === 'Tipo de aviso').props.children;
  assert.equal(picker.props.value, recordedAccessVoice);
  assert.throws(() => findElement(tree, e => e.type === 'input' && e.props.type === 'range'));
  assert.throws(() => findElement(tree, e => e.type === 'Field' && e.props.label === 'Nombre para probar'));
  for (const [result, label] of [['allowed', 'permitido'], ['denied', 'denegado']]) {
    findElement(tree, e => e.type === 'button' && elementText(e) === `Probar acceso ${label}`).props.onClick();
    tree = await h.settle();
    assert.equal(calls.at(-1), result);
    assert.match(elementText(tree), new RegExp(`Audio de acceso ${label} reproducido`));
  }
});

test('Apariencia guarda el tema y el color de acento solo al confirmar', async (t) => {
  const h = componentHarness();
  t.after(() => h.cleanup());
  const preferences = { theme: 'light', density: 'comfortable', accent: '#636b2f' };
  const { default: Appearance } = h.load('../src/Appearance.tsx', {
    './preferences': {
      usePreferences: () => preferences,
      saveAppearance: (change: Partial<typeof preferences>) => { Object.assign(preferences, change); return true; },
    },
    './ui': { Field: 'Field' },
    './styles/appearance.css': {},
  });
  const button = (tree: unknown, match: (element: { props: Record<string, any> }) => boolean) =>
    findElement(tree, (element) => element.type === 'button' && match(element));
  let tree = h.render(Appearance);
  assert.equal(button(tree, (e) => elementText(e).startsWith('Oscuro')).props['aria-pressed'], false);
  button(tree, (e) => elementText(e).startsWith('Oscuro')).props.onClick();
  button(h.render(Appearance), (e) => e.props['aria-label'] === 'Azul').props.onClick();
  tree = h.render(Appearance);
  assert.equal(preferences.theme, 'light');
  assert.equal(preferences.accent, '#636b2f');
  assert.equal(button(tree, (e) => e.props['aria-label'] === 'Azul').props['aria-pressed'], true);
  assert.throws(() => findElement(tree, (e) => e.type === 'Field' && e.props.label === 'Tipo de aviso'));
  button(tree, (e) => elementText(e) === 'Guardar cambios').props.onClick();
  tree = await h.settle();
  assert.equal(preferences.theme, 'dark');
  assert.equal(preferences.accent, '#2455a4');
  assert.match(elementText(tree), /Apariencia guardada para este gimnasio/);
});
