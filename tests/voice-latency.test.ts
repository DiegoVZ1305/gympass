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

test('una voz de GymPASS lenta cede a la voz del teléfono en 250 ms y no suena después', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let ready!: () => void;
  const prepared = new Promise<void>(resolve => { ready = resolve; });
  const messages: string[] = [];
  let played = 0;
  class Audio { state = 'running'; decodeAudioData = async () => ({}); createBuffer() { played++; throw Error('Audio tardío'); } }
  const h = componentHarness({ Worker: class {}, AudioContext: Audio, fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
    window: { __gympassNativeVoice: { speak: async (text: string) => { messages.push(text); return true; }, stop() {} } },
  });
  const { accessFeedback } = h.load('../src/feedback.ts', { './voice-engine': {
    prepareGympassVoice: () => prepared,
    renderGympassVoice: async () => ({ samples: Float32Array.of(0), sampleRate: 44100 }),
  } });
  const pending = accessFeedback(true, true, false, 'entry', 'Ana', { voiceURI: 'gympass:F1', voiceGender: 'female', voiceRate: 1 });
  await h.settle();
  assert.deepEqual(messages, []);
  t.mock.timers.tick(250);
  await h.settle();
  assert.equal(await pending, 'device');
  assert.deepEqual(messages, ['Entrando, Ana.']);
  ready();
  await h.settle();
  assert.equal(played, 0);
});
