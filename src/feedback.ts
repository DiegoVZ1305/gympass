import {
  defaultVoiceSettings, feedbackAnnouncement, feedbackSound, normalizeVoiceSettings, preferredSpanishVoice,
  beepAccessVoice, recordedAccessSound, recordedAccessVoice, voiceGender, voiceIdentity, type VoiceSettings,
} from '../lib/access-feedback';
let context: AudioContext | undefined;
const buffers = new Map<string, Promise<AudioBuffer>>();
let playing: AudioBufferSourceNode | undefined;
let sequence = 0;
let activeSpeech: { utterance: SpeechSynthesisUtterance; stop: () => void } | undefined;
declare global {
  interface Window {
    __gympassNativeVoice?: { speak(text: string, rate: number): Promise<boolean>; stop(): void };
  }
}

function speechEngine() {
  return typeof window !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : undefined;
}

function availableVoices(engine: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const voices = engine.getVoices();
  if (voices.length) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const ready = () => {
      clearTimeout(timer);
      engine.removeEventListener('voiceschanged', ready);
      resolve(engine.getVoices());
    };
    const timer = setTimeout(ready, 150);
    engine.addEventListener('voiceschanged', ready);
  });
}

export function subscribeAccessVoices(listener: (voices: SpeechSynthesisVoice[]) => void) {
  const engine = speechEngine();
  const update = () => {
    let voices: SpeechSynthesisVoice[] = [];
    try { voices = engine?.getVoices() || []; } catch {}
    const seen = new Set<string>();
    listener(voices.filter((voice) => {
      const id = voiceIdentity(voice);
      if (!/^es(?:[-_]|$)/i.test(voice.lang) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }));
  };
  update();
  engine?.addEventListener('voiceschanged', update);
  return () => engine?.removeEventListener('voiceschanged', update);
}

function speak(engine: SpeechSynthesis, text: string, rate: number, voice?: SpeechSynthesisVoice) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang.replaceAll('_', '-') || 'es-BO';
  if (voice) utterance.voice = voice;
  utterance.rate = rate;
  return new Promise<boolean>((resolve) => {
    const finish = (spoken: boolean) => {
      clearTimeout(timer);
      utterance.onstart = utterance.onend = utterance.onerror = null;
      if (activeSpeech?.utterance === utterance) activeSpeech = undefined;
      resolve(spoken);
    };
    // Some engines fail silently: keep an audible confirmation if speech never starts.
    const timer = setTimeout(() => {
      finish(false);
      try { engine.cancel(); } catch {}
    }, 800);
    activeSpeech = { utterance, stop: () => finish(true) };
    utterance.onstart = () => clearTimeout(timer);
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    try {
      if (engine.paused) engine.resume();
      engine.speak(utterance);
    } catch {
      finish(false);
    }
  });
}

async function announce(direction: string, personName: string, current: number, settings: VoiceSettings, allowed: boolean): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && window.__gympassNativeVoice) {
      if (current !== sequence) return true;
      return await window.__gympassNativeVoice.speak(feedbackAnnouncement(direction, personName, allowed), settings.voiceRate);
    }
    const engine = speechEngine();
    if (!engine) return false;
    const voices = await availableVoices(engine);
    if (current !== sequence) return true;
    const voice = preferredSpanishVoice(voices, navigator.onLine !== false, settings);
    const text = feedbackAnnouncement(direction, personName, allowed);
    if (await speak(engine, text, settings.voiceRate, voice)) return true;
    if (current !== sequence) return true;
    if (voice && !voice.localService) {
      const gender = voiceGender(voice);
      const local = preferredSpanishVoice(voices, false, { ...settings, voiceGender: gender === 'auto' ? settings.voiceGender : gender });
      if (local) return await speak(engine, text, settings.voiceRate, local);
    }
    return false;
  } catch {
    return false;
  }
}

function buffer(name: string) {
  if (!buffers.has(name)) {
    const work = fetch(`/sounds/${name}.wav`)
      .then((response) => {
        if (!response.ok) throw Error('Audio no disponible.');
        return response.arrayBuffer();
      })
      .then((bytes) => context!.decodeAudioData(bytes));
    buffers.set(name, work);
    void work.catch(() => buffers.delete(name));
  }
  return buffers.get(name)!;
}
export function prepareAccessVoice(_voiceURI: string) {
  try { speechEngine()?.getVoices(); } catch {}
}

export function prepareAudio() {
  try {
    // Start loading voices during the user's interaction, before a scan completes.
    speechEngine()?.getVoices();
  } catch {}
  try {
    context ||= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    for (const name of ['entry', 'exit', 'denied', 'allowed-recorded', 'denied-recorded']) void buffer(name).catch(() => {});
  } catch {
    /* Audio is optional. */
  }
}
function playBuffer(decoded: AudioBuffer) {
  if (!context || context.state !== 'running') return false;
  playing = context.createBufferSource();
  playing.buffer = decoded;
  playing.connect(context.destination);
  playing.start();
  return true;
}
export function stopFeedback() {
  ++sequence;
  activeSpeech?.stop();
  try { if (typeof window !== 'undefined') window.__gympassNativeVoice?.stop(); } catch {}
  try { speechEngine()?.cancel(); } catch {}
  try { playing?.stop(); } catch {}
  playing = undefined;
}

export async function accessFeedback(
  allowed: boolean, sound: boolean, vibration: boolean, direction = 'entry', personName = '',
  settings: VoiceSettings = defaultVoiceSettings, preview = false,
): Promise<'gympass' | 'device' | 'recorded' | 'tone' | 'none'> {
  if (vibration) {
    try {
      navigator.vibrate?.(allowed ? [80] : [100, 60, 100]);
    } catch {}
  }
  stopFeedback();
  const current = sequence;
  if (!sound) return 'none';
  prepareAudio();
  try {
    const options = normalizeVoiceSettings(settings);
    if (options.voiceURI === recordedAccessVoice) {
      try {
        const decoded = await buffer(recordedAccessSound(allowed));
        if (current === sequence && playBuffer(decoded)) return 'recorded';
      } catch {
        // Keep the original confirmation tone if a recording cannot be loaded.
      }
    } else if (options.voiceURI !== beepAccessVoice) {
      if (current !== sequence) return 'none';
      if (await announce(direction, personName, current, { ...options, voiceURI: '', voiceGender: 'auto' }, allowed)) return current === sequence ? 'device' : 'none';
    }
    if (current !== sequence || !context) return 'none';
    const decoded = await buffer(options.voiceURI === beepAccessVoice ? (allowed ? 'entry' : 'denied') : feedbackSound({ allowed: Number(allowed), direction }));
    if (current === sequence && playBuffer(decoded)) return 'tone';
  } catch {
    /* Audio failure must never interrupt access registration. */
  }
  return 'none';
}
