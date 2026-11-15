import { useEffect, useRef, useState } from 'react';
import { accessVoiceMode, beepAccessVoice, recordedAccessVoice, voiceRateLimits } from '../lib/access-feedback';
import { Field } from './ui';
import { usePreferences, updatePreferences, type Preferences } from './preferences';
import { accessFeedback, prepareAccessVoice, prepareAudio, stopFeedback } from './feedback';
import './styles/appearance.css';

/** Avisos de entrada y salida: audios, voces y vibración de este dispositivo. */
export default function AccessSounds() {
  const preferences = usePreferences();
  const [changes, setChanges] = useState<Partial<Preferences>>({});
  const [saveMessage, setSaveMessage] = useState('');
  const draft = { ...preferences, ...changes };
  const dirty = Object.entries(changes).some(([key, value]) => preferences[key as keyof Preferences] !== value);
  const [sampleName, setSampleName] = useState('María Pérez');
  const [testing, setTesting] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const previewId = useRef(0);
  useEffect(() => {
    return () => {
      previewId.current++;
      stopFeedback();
    };
  }, []);

  const mode = accessVoiceMode(draft.voiceURI);
  const recorded = mode === recordedAccessVoice;
  const beep = mode === beepAccessVoice;
  const named = !recorded && !beep;
  const voiceHint = recorded
    ? 'Tus grabaciones: «Acceso permitido» cuando el código es válido y «Acceso denegado» cuando no lo es o está vencido. Se reproducen sin añadir nombres.'
    : beep ? 'Un beep para acceso correcto y otro distinto para acceso denegado. Sin voz ni nombres.'
    : 'Una sola voz en español del dispositivo anuncia la entrada, salida o acceso denegado junto con el nombre. Sin descargar modelos.';
  const cancelPreview = () => {
    previewId.current++;
    setTesting(false);
    setPreviewMessage('');
    stopFeedback();
  };
  const edit = (change: Partial<Preferences>) => {
    setSaveMessage('');
    setChanges((current) => ({ ...current, ...change }));
  };
  const changeVoice = (change: Partial<Preferences>) => {
    cancelPreview();
    edit(change);
  };
  const save = () => {
    if (!dirty) return;
    if (!draft.sound) cancelPreview();
    else {
      prepareAudio();
      prepareAccessVoice(draft.voiceURI);
    }
    const stored = updatePreferences(changes);
    setChanges({});
    setSaveMessage(stored ? 'Cambios guardados en este navegador.' : 'Cambios aplicados durante esta sesión.');
  };
  const selectVoice = (id: string) => {
    changeVoice({ voiceURI: accessVoiceMode(id), voiceGender: 'auto' });
  };
  const preview = async (direction: 'entry' | 'exit', allowed = true) => {
    const id = ++previewId.current;
    setTesting(true);
    setPreviewMessage(named ? 'Probando la voz con nombre…' : 'Reproduciendo el sonido…');
    const played = await accessFeedback(allowed, true, false, direction, sampleName.trim() || 'María Pérez', draft, true);
    if (id !== previewId.current) return;
    setTesting(false);
    setPreviewMessage(played === 'none' ? 'No se pudo reproducir el aviso. Comprueba el audio del dispositivo.'
      : played === 'tone' ? beep ? `Beep de acceso ${allowed ? 'correcto' : 'denegado'} reproducido.` : 'La voz no está disponible. Se reprodujo el beep de confirmación.'
      : played === 'recorded' ? `Audio de acceso ${allowed ? 'permitido' : 'denegado'} reproducido.`
      : '');
  };
  return (
    <section className="panel padded appearance-panel">
      <section className="access-voice-settings" aria-label="Avisos de acceso">
        <h3>Avisos de acceso</h3>
        <div className="check-list">
        <label>
          <input
            type="checkbox"
            checked={draft.sound}
            onChange={(event) => edit({ sound: event.target.checked })}
          />{' '}
          Reproducir avisos de entrada y salida
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.vibration}
            onChange={(event) => edit({ vibration: event.target.checked })}
          />{' '}
          Vibración al registrar acceso
        </label>
        </div>
      </section>
      <section className="access-voice-settings" aria-label="Avisos de voz">
        <h3>Sonidos y voces</h3>
        <div className="form-grid">
          <Field label="Tipo de aviso" hint={voiceHint}>
            <select value={mode} onChange={(event) => selectVoice(event.target.value)}>
              <option value="">Voz con nombre</option>
              <option value={recordedAccessVoice}>Audios de acceso permitido y denegado</option>
              <option value={beepAccessVoice}>Beeps: correcto y denegado</option>
            </select>
          </Field>
          {named && <Field label={`Velocidad de voz (${Math.round(draft.voiceRate * 100)} %)`} hint="De 50 % a 300 %. 100 % es la velocidad normal.">
            <input type="range" {...voiceRateLimits} value={draft.voiceRate} onChange={(event) => changeVoice({ voiceRate: event.target.valueAsNumber })} />
          </Field>}
          {named && <Field label="Nombre para probar">
            <input value={sampleName} maxLength={80} onChange={(event) => setSampleName(event.target.value)} />
          </Field>}
        </div>
        <div className="voice-preview-actions">
          {!named ? (
            <>
              <button type="button" className="btn secondary" disabled={testing} onClick={() => void preview('entry')}>Probar acceso permitido</button>
              <button type="button" className="btn secondary" disabled={testing} onClick={() => void preview('entry', false)}>Probar acceso denegado</button>
            </>
          ) : (
            <>
              <button type="button" className="btn secondary" disabled={testing} onClick={() => void preview('entry')}>Probar entrada</button>
              <button type="button" className="btn secondary" disabled={testing} onClick={() => void preview('exit')}>Probar salida</button>
              <button type="button" className="btn secondary" disabled={testing} onClick={() => void preview('entry', false)}>Probar acceso denegado</button>
            </>
          )}
          {testing && <button type="button" className="btn secondary" onClick={cancelPreview}>Detener prueba</button>}
        </div>
        {previewMessage && <p className="helper" role="status">{previewMessage}</p>}
      </section>
      <div className="appearance-save">
        <button type="button" className="btn primary" disabled={!dirty} onClick={save}>Guardar cambios</button>
        <p className="helper" role="status">{saveMessage || (dirty ? 'Tienes cambios sin guardar.' : 'Los ajustes se guardan en este navegador.')}</p>
      </div>
    </section>
  );
}
