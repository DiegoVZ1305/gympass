import test from 'node:test';
import assert from 'node:assert/strict';
import { componentHarness } from './component-harness.ts';

test('Android anuncia nombre y rechazo con su voz nativa aunque Web Speech no exista', async () => {
  const messages: { text: string; rate: number }[] = [];
  let stopped = 0;
  const h = componentHarness({ window: { __gympassNativeVoice: {
    speak: async (text: string, rate: number) => { messages.push({ text, rate }); return true; },
    stop: () => stopped++,
  } } });
  const { accessFeedback, stopFeedback } = h.load('../src/feedback.ts');
  assert.equal(await accessFeedback(false, true, false, 'exit', 'Ana Pérez'), 'device');
  assert.equal(messages[0].text, 'Acceso denegado, Ana Pérez.');
  stopFeedback();
  assert.equal(stopped, 2);
});

test('una voz antigua se migra a la voz del teléfono sin cargar modelos ni esperar inferencia', async () => {
  const messages: string[] = [];
  let workers = 0;
  const h = componentHarness({ Worker: class { constructor() { workers++; } },
    window: { __gympassNativeVoice: { speak: async (text: string) => { messages.push(text); return true; }, stop() {} } },
  });
  const { accessFeedback } = h.load('../src/feedback.ts');
  assert.equal(await accessFeedback(true, true, false, 'entry', 'Ana', { voiceURI: 'gympass:F1', voiceGender: 'female', voiceRate: 1 }), 'device');
  assert.deepEqual(messages, ['Entrando, Ana.']);
  assert.equal(workers, 0);
});
