import { useState } from 'react';
import { HardDrive, Server, ShieldCheck } from 'lucide-react';
import { Field, Form } from './ui';
import { connectionDestination, connectionMode } from './connection-mode';
import { api } from './api';

export default function ConnectionSettings({ platform }: { platform: boolean }) {
  const desktop = /GymPASSConnection\//.test(navigator.userAgent);
  const current = desktop ? connectionMode(navigator.userAgent, location.hostname) : platform ? 'remote' : 'local';
  const savedWork = /GymPASSWork\/(local|server|isolated)\b/.exec(navigator.userAgent)?.[1] as 'local' | 'server' | 'isolated' | undefined;
  const [mode, setMode] = useState<'local' | 'isolated' | 'remote'>(savedWork === 'isolated' ? 'isolated' : savedWork === 'local' || current === 'local' ? 'local' : 'remote');
  const nativeServer = /GymPASSServer\/([^\s]+)/.exec(navigator.userAgent)?.[1];
  const [server, setServer] = useState(
    nativeServer ? decodeURIComponent(nativeServer) : current === 'remote' ? location.origin : 'https://gympass.site',
  );
  const [local, setLocal] = useState(current === 'local' ? location.origin : 'http://localhost:3000');
  return (
    <section className="panel padded connection-settings" aria-labelledby="connection-mode-title">
      <h3 id="connection-mode-title">Servidor y copia local de tu gimnasio</h3>
      <p>Usa los mismos socios, planes, cobros y credenciales en los dos modos. La aplicación guarda una copia automáticamente para seguir trabajando sin Internet.</p>
      <p className="helper">
        Conexión actual:{' '}
        <strong>
          {current === 'local' ? 'Base local anterior' : current === 'replica' ? savedWork === 'isolated' ? 'Local independiente' : savedWork === 'local' ? 'Copia local sincronizada' : 'Servidor con copia automática' : 'Servidor'}
        </strong>
        .
      </p>
      <Form
        label={desktop ? 'Guardar conexión y reiniciar' : 'Abrir conexión'}
        onSubmit={async (form) => {
          let authorization: { token: string; server: string } | undefined;
          if (desktop) {
            const credentials = {
              email: String(form.get('connection_superadmin_email') || '').trim(),
              password: String(form.get('connection_superadmin_password') || ''),
            };
            authorization = current === 'remote'
              ? { token: (await api<{ token: string }>('platform/connection-authorize', 'POST', credentials)).token, server: location.origin }
              : await api<{ token: string; server: string }>('cloud-sync/authorize-connection', 'POST', { ...credentials, server });
          }
          if (desktop && current === 'replica') {
            const status = await api<{ conflict?: string; revoked?: boolean; pending: number; error?: string }>('cloud-sync/run', 'POST');
            if (status.conflict || status.revoked) throw Error(status.conflict || 'Vuelve a vincular esta copia con tu cuenta antes de cambiar la conexión.');
            if (mode === 'remote' && status.pending) throw Error('Conecta esta computadora a Internet para enviar sus cambios pendientes antes de abrir el servidor.');
          }
          location.assign(
            connectionDestination(
              desktop ? 'replica' : mode === 'local' ? 'local' : 'remote',
              server,
              local,
              desktop,
              mode === 'isolated' ? 'isolated' : mode === 'local' ? 'local' : 'server',
              authorization?.token,
              authorization?.server,
            ),
          );
        }}
      >
        <fieldset className="connection-options">
          <legend>Modo de trabajo</legend>
          <label className="connection-option">
            <input
              type="radio"
              name="mode"
              value="local"
              checked={mode === 'local'}
              onChange={() => setMode('local')}
            />
            <HardDrive size={22} aria-hidden="true" />
            <span>
              <strong>Copia local de este gimnasio</strong>
              <small>Conserva los datos del servidor y permite trabajar sin Internet. Los cambios se envían al reconectar.</small>
            </span>
          </label>
          {desktop && <label className="connection-option">
            <input type="radio" name="mode" value="isolated" checked={mode === 'isolated'} onChange={() => setMode('isolated')} />
            <ShieldCheck size={22} aria-hidden="true" />
            <span>
              <strong>Local independiente</strong>
              <small>Descarga la última copia y guarda los cambios solo en este dispositivo. No consulta ni sube nada al servidor.</small>
            </span>
          </label>}
          <label className="connection-option">
            <input
              type="radio"
              name="mode"
              value="remote"
              checked={mode === 'remote'}
              onChange={() => setMode('remote')}
            />
            <Server size={22} aria-hidden="true" />
            <span>
              <strong>Servidor y copia automática</strong>
              <small>Trabaja conectado y mantén una copia del mismo gimnasio en esta computadora.</small>
            </span>
          </label>
        </fieldset>
        {desktop && <>
          <Field label="Correo del superadmin">
            <input name="connection_superadmin_email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Contraseña del superadmin" hint="Solo el superadmin puede cambiar el modo de conexión.">
            <input name="connection_superadmin_password" type="password" autoComplete="current-password" required />
          </Field>
        </>}
        {mode === 'remote' || mode === 'isolated' ? (
          <>
            <Field label="Dirección del servidor">
              <input
                type="url"
                required
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="https://gympass.site"
                autoComplete="url"
              />
            </Field>
            {desktop && <p className="helper">{mode === 'isolated' ? 'Esta dirección queda guardada para cuando elijas volver a conectar al servidor.' : 'La copia local está incluida y se mantiene actualizada automáticamente.'}</p>}
          </>
        ) : (
          !desktop && (
            <Field
              label="Dirección local"
              hint="GymPASS de escritorio o su servidor local debe estar abierto en esta computadora."
            >
              <input
                type="url"
                required
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="http://localhost:3000"
              />
            </Field>
          )
        )}
        <p className="helper">
          {desktop
            ? mode === 'isolated'
              ? 'Antes de activar este modo se actualiza la copia local. Después, todas las altas, cobros y cambios quedan únicamente en este dispositivo; para sincronizar, vuelve a elegir Servidor y copia automática.'
              : 'Los modos utilizan la misma copia del gimnasio. En el primer acceso, inicia sesión con tu cuenta administradora del servidor: los datos se descargarán antes de entrar. La base independiente de versiones anteriores se conserva aparte.'
            : 'Esta página trabaja con el servidor. Para usar su copia local, abre GymPASS para Windows en esta computadora e inicia sesión allí una vez con Internet. Después puedes abrir esa misma copia desde este navegador.'}
        </p>
      </Form>
    </section>
  );
}
