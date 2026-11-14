import test from 'node:test';
import assert from 'node:assert/strict';
import { cardSvg } from '../lib/card.ts';
import { componentHarness } from './component-harness.ts';

test('la credencial muestra el plan y conserva el QR sin insertar fotos antiguas', async () => {
  const calls: string[] = [];
  const h = componentHarness();
  const { credentialCardData } = h.load('../src/credential-cards.ts', {
    './api': { api: async () => ({ name: 'Ana Pérez', document: '123', person_kind: 'member', person_id: 'ana', photo_path: 'antigua.png', code: 'PERMANENT-QR', plan_name: '15 sesiones < mensual' }) },
    './card-download': { inlineLogo: async () => null, inlinePhoto: async () => { calls.push('photo'); return 'data:image/png;base64,AAAA'; } },
    '../lib/domain': { kindLabels: { member: 'Socio' } }, '../lib/branding': { displayBrandColor: () => '#636b2f' },
  });
  const card = await credentialCardData('qr', { name: 'Gym', brand_color: '#636b2f' });
  assert.equal(card.plan_name, '15 sesiones < mensual');
  assert.equal(card.code, 'PERMANENT-QR');
  assert.deepEqual(calls, []);
  const svg = cardSvg({ ...card, photo: 'data:image/png;base64,AAAA' });
  assert.match(svg, /15 sesiones &lt; mensual/);
  assert.doesNotMatch(svg, /photoClip|data:image\/png;base64,AAAA/);
});
