export type ConnectionMode = 'local' | 'remote' | 'replica';
export type ReplicaWorkMode = 'local' | 'server' | 'isolated';

export function connectionMode(userAgent: string, hostname: string): ConnectionMode {
  const native = /GymPASSConnection\/(local|remote|replica)\b/.exec(userAgent);
  if (native) return native[1] as ConnectionMode;
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? 'local' : 'remote';
}

export function serverOrigin(value: string): string {
  if (!/^https:\/\/[^/?#\\]+\/?$/i.test(value.trim()))
    throw Error('Escribe solo la dirección HTTPS del servidor, sin rutas ni credenciales.');
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw Error('Escribe solo la dirección HTTPS del servidor, sin rutas ni credenciales.');
  return url.origin;
}

export function localOrigin(value: string): string {
  const url = new URL(value.trim());
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw Error('Usa la dirección local de esta computadora, por ejemplo http://localhost:3000.');
  return url.origin;
}

export function connectionDestination(mode: ConnectionMode, server: string, local: string, desktop: boolean, work?: ReplicaWorkMode, authorization?: string, authorizationServer?: string): string {
  if (desktop) {
    const nativeMode = mode === 'local' ? 'replica' : mode;
    const query = new URLSearchParams({ mode: nativeMode });
    query.set('server', serverOrigin(server || 'https://gympass.site'));
    // A replica has two possible working modes. Always send it explicitly so
    // the desktop client cannot fall back to the server after restarting.
    if (nativeMode === 'replica') query.set('work', work || (mode === 'local' ? 'local' : 'server'));
    if (authorization) query.set('authorization', authorization);
    if (authorizationServer) query.set('authorization_server', serverOrigin(authorizationServer));
    return 'gympass-connection://apply/?' + query;
  }
  return (mode === 'local' ? localOrigin(local) : serverOrigin(server)) + '/';
}
