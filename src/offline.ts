import { useSyncExternalStore } from 'react';
import { api } from './api';
import type { AccessEvent, Bootstrap } from '../lib/domain';
import {
  OfflineAccessQueue,
  type QueueCapture,
  type QueueIdentity,
  type QueuedAccess,
  type StoredAccess,
} from './offline-queue';

export type { QueuedAccess } from './offline-queue';
const databaseName = 'gympass-offline';
const storeName = 'access-queue';
let connection: Promise<IDBDatabase | null> | null = null;

function open() {
  connection ||= new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (!globalThis.indexedDB) return resolve(null);
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName))
          request.result.createObjectStore(storeName, { keyPath: 'request_id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return connection;
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const transaction = db.transaction(storeName, mode);
      const request = run(transaction.objectStore(storeName));
      let result: T;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function insert(record: QueuedAccess) {
  const db = await open();
  if (!db) return null;
  return new Promise<StoredAccess | null>((resolve) => {
    try {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(record.request_id);
      let result: StoredAccess;
      request.onsuccess = () => {
        if (request.result) result = request.result as StoredAccess;
        else {
          result = record;
          store.add(record);
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => resolve(null);
      transaction.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const queue = new OfflineAccessQueue(
  {
    async list() {
      return (await transact<StoredAccess[]>('readonly', (store) => store.getAll())) || [];
    },
    insert,
    async remove(requestId) {
      const result = await transact('readwrite', (store) => store.delete(requestId));
      if (result === null)
        throw new Error(
          'El movimiento se envió, pero la cola local no pudo actualizarse. Se comprobará al reintentar.',
        );
    },
    async update(requestId, identity, changes) {
      const db = await open();
      if (!db) throw new Error('No se puede actualizar la cola local en este navegador.');
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.get(requestId);
        let message = 'No se pudo guardar la revisión del movimiento.';
        request.onsuccess = () => {
          const record = request.result as StoredAccess | undefined;
          if (!record || record.installation_id !== identity.installation_id || record.actor_id !== identity.actor_id) {
            message = 'El movimiento no pertenece a esta sesión.';
            transaction.abort();
            return;
          }
          store.put({ ...record, ...changes });
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(new Error(message));
        transaction.onerror = () => reject(new Error(message));
      });
    },
  },
  (body, signal) => api<AccessEvent>('access', 'POST', body, signal),
);

export function accessQueueIdentity(data: Bootstrap): QueueIdentity {
  return { installation_id: data.installation_id, actor_id: data.user.id, role: data.user.role };
}
export function setAccessQueueIdentity(identity: QueueIdentity | null) {
  return queue.setIdentity(identity);
}
export function captureAccessIdentity(identity: QueueIdentity) {
  return queue.capture(identity);
}
export function enqueueAccess(record: QueuedAccess, capture: QueueCapture) {
  return queue.enqueue(record, capture);
}
export function flushAccessQueue() {
  return queue.flush();
}
export function reviewAccessQueue() {
  return queue.reviewRecords();
}
export function setAccessReview(requestId: string, held: boolean) {
  return queue.setReview(requestId, held);
}
/** Primer reintento tras una caída, y tope al que llega si el servidor sigue sin responder. */
const firstRetry = 3000,
  maxRetry = 30000,
  idleCheck = 20000;
/**
 * Mantiene viva la reconexión sin que nadie pulse nada: mientras queden movimientos sin enviar
 * reintenta a los 3 s y va espaciando hasta 30 s, y cualquier señal de que la red volvió
 * (`online`, foco, pestaña visible) o un movimiento nuevo vuelve al intento inmediato.
 * `onSent` avisa cuando el servidor por fin aceptó algo, para refrescar lo que se ve en pantalla.
 */
export function startOfflineQueue(onSent?: (sent: number) => void) {
  void queue.refresh();
  let timer: ReturnType<typeof setTimeout> | null = null,
    delay = firstRetry,
    pending = queue.snapshot().pending,
    stopped = false;
  const schedule = (wait: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void attempt(), wait);
  };
  const attempt = async () => {
    if (stopped) return;
    const state = queue.snapshot();
    if (!state.pending || state.sending) return schedule(idleCheck);
    if (navigator.onLine === false) return schedule(maxRetry);
    let sent = 0;
    try {
      sent = (await flushAccessQueue()).sent;
    } catch {
      // Un fallo de envío no detiene el ciclo: solo alarga la espera del siguiente intento.
    }
    if (stopped) return;
    if (sent) onSent?.(sent);
    pending = queue.snapshot().pending;
    delay = sent || !pending ? firstRetry : Math.min(delay * 2, maxRetry);
    schedule(pending ? delay : idleCheck);
  };
  const soon = () => {
    delay = firstRetry;
    schedule(0);
  };
  const visible = () => {
    if (document.visibilityState === 'visible') soon();
  };
  // Un movimiento nuevo en la cola significa que el servidor acaba de fallar: reintenta pronto.
  const unsubscribe = queue.subscribe(() => {
    const next = queue.snapshot().pending;
    if (next > pending) {
      pending = next;
      delay = firstRetry;
      schedule(firstRetry);
    } else pending = next;
  });
  window.addEventListener('online', soon);
  window.addEventListener('focus', soon);
  document.addEventListener('visibilitychange', visible);
  schedule(0);
  return () => {
    stopped = true;
    unsubscribe();
    window.removeEventListener('online', soon);
    window.removeEventListener('focus', soon);
    document.removeEventListener('visibilitychange', visible);
    if (timer) clearTimeout(timer);
  };
}
export function useAccessQueue() {
  return useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot);
}
