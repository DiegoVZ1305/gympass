import { useState } from 'react';
import { CheckCircle2, LoaderCircle, ScanLine, Ticket, Users } from 'lucide-react';
import type { Bootstrap } from '../lib/domain';
import type { PosSaleDetail } from '../lib/pos-types';
import { api, HttpError, NetworkError } from './api';
import { newRequestId } from './browser';
import { EventTable, PageHeader, type Notify } from './ui';
import GymPresence from './GymPresence';

const money = (cents: number) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(cents / 100);

/** Cobra una sesión suelta con un solo toque: sin socio, sin catálogo y sin pantalla intermedia. */
export function SellSession({
  data,
  reload,
  notify,
}: {
  data: Bootstrap;
  reload: (topics?: string[]) => Promise<void>;
  notify: Notify;
}) {
  const quick = data.settings.quick_session!;
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn secondary"
      disabled={busy}
      // Mientras el cobro viaja, la misma guarda de Caja impide cambiar de pantalla.
      data-payment-pending={busy ? 'true' : undefined}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const sale = await api<PosSaleDetail>('pos/checkout', 'POST', {
            request_id: newRequestId(),
            payment_method: quick.payment_method,
            expected_total_cents: quick.price_cents,
            lines: [{ kind: 'product', id: quick.product_id, quantity: 1 }],
          });
          notify(`Sesión cobrada · ${money(sale.total_cents)}. Queda en Caja y en los informes.`);
          await reload(['pos']).catch(() => {});
        } catch (reason) {
          // Una respuesta perdida pudo registrar el cobro: conviene mirarlo antes de repetirlo.
          const uncertain =
            reason instanceof NetworkError || (reason instanceof HttpError && reason.status >= 500);
          const message = reason instanceof Error ? reason.message : 'No se pudo cobrar la sesión.';
          notify(uncertain ? message + ' Revisa «Ventas hechas» antes de cobrar otra vez.' : message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <LoaderCircle size={18} className="spin" /> : <Ticket size={18} />}
      {busy ? 'Cobrando…' : `Vender sesión · ${money(quick.price_cents)}`}
    </button>
  );
}

export default function Dashboard({
  data,
  reload,
  notify,
}: {
  data: Bootstrap;
  reload: (topics?: string[]) => Promise<void>;
  notify: Notify;
}) {
  const capacityAlerts = data.zones.filter(
    (zone) => zone.active && zone.capacity > 0 && zone.inside >= zone.capacity * 0.9,
  );
  const canSell = data.user.role !== 'viewer' && !data.platform?.read_only;
  return (
    <>
      <PageHeader
        title="Hoy en tu gimnasio"
        description="Mira quién está entrenando ahora y registra cuando alguien llega o se va."
        primaryAction={
          data.user.role !== 'viewer' && (
            <>
              <a className="btn primary" href="#access">
                <ScanLine size={18} />
                Registrar entrada o salida
              </a>
              {canSell && !!data.settings.quick_session && (
                <SellSession data={data} reload={reload} notify={notify} />
              )}
            </>
          )
        }
      />
      {data.user.role === 'admin' && data.stats.activePeople === 0 && (
        <section className="panel" aria-labelledby="first-steps">
          <div className="panel-heading">
            <div>
              <h2 id="first-steps">Empieza en 4 pasos</h2>
              <p>Cuando termines, aquí verás quién está entrenando.</p>
            </div>
          </div>
          <ol className="priority-list">
            {[
              ['Registra a tu primer socio', 'Nombre y datos básicos.', '#people?new', 'Registrar socio'],
              ['Crea y cobra su plan', 'En Caja, crea un plan y confirma el cobro. El acceso empieza en la fecha de inicio del plan pagado.', '#pos', 'Abrir Caja'],
              ['Entrégale su credencial QR', 'El primer cobro crea su QR permanente. Puedes descargarlo o compartirlo.', '#credentials', 'Ver credenciales'],
              ['Registra su entrada', 'Muestra el QR en la cámara.', '#access', 'Registrar entrada'],
            ].map(([title, text, href, action]) => (
              <li key={title}>
                <CheckCircle2 size={21} aria-hidden="true" />
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
                <a className="btn secondary small" href={href}>
                  {action}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="dashboard-layout">
        <div className="dashboard-main">
          {!!capacityAlerts.length && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Ocupación de las zonas</h2>
              </div>
              <ul className="priority-list">
                {capacityAlerts.map((zone) => (
                  <li key={zone.id}>
                    <Users size={21} />
                    <div>
                      <strong>
                        {zone.name}: {zone.inside >= zone.capacity ? 'aforo completo' : 'cerca del aforo'}
                      </strong>
                      <p>
                        {zone.inside} de {zone.capacity} personas dentro
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <GymPresence data={data} />
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Últimas entradas y salidas</h2>
                <p>Lo más reciente que pasó en el gimnasio.</p>
              </div>
              {data.user.role !== 'operator' && (
                <a className="text-link" href="#history">
                  Ver todo el historial
                </a>
              )}
            </div>
            <EventTable events={data.events} timezone={data.settings.timezone} />
          </section>
        </div>
        <aside className="today-summary" aria-label="Resumen de hoy">
          <h2>Resumen de hoy</h2>
          <dl>
            {[
              ['Llegadas', data.stats.entries],
              ['Salidas', data.stats.exits],
              ['Entradas rechazadas', data.stats.denied],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{new Intl.NumberFormat('es-BO').format(Number(value))}</dd>
              </div>
            ))}
          </dl>
          {data.user.role !== 'operator' && (
            <a className="text-link" href="#history">
              Ver el motivo de cada rechazo
            </a>
          )}
        </aside>
      </div>
    </>
  );
}
