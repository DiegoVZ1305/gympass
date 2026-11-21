import { useEffect, useState } from 'react';
import type { Settings } from '../lib/domain';
import type { PaymentMethod, PosCatalog, PosProduct } from '../lib/pos-types';
import { api } from './api';
import { Field, Form, Skeleton } from './ui';

const money = (cents: number) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(cents / 100);
const methods: Record<PaymentMethod, string> = { cash: 'Efectivo', transfer: 'Transferencia o QR', card: 'Tarjeta' };

/**
 * Venta rápida de sesión: elige qué producto cobra el botón de Inicio.
 * El cobro no lleva socio, así que la sesión se vende como producto y no como plan.
 */
export default function QuickSession({ settings, saved }: { settings: Settings; saved: () => Promise<void> }) {
  const [products, setProducts] = useState<PosProduct[] | null>(null),
    [error, setError] = useState(''),
    [enabled, setEnabled] = useState(!!settings.quick_session_product_id),
    [product, setProduct] = useState(settings.quick_session_product_id || ''),
    [method, setMethod] = useState<PaymentMethod>(settings.quick_session_payment_method || 'cash');
  useEffect(() => {
    const controller = new AbortController();
    void api<PosCatalog>('pos/catalog', 'GET', undefined, controller.signal)
      .then((catalog) => setProducts(catalog.products))
      .catch((reason) => {
        if (!controller.signal.aborted) setError((reason as Error).message);
      });
    return () => controller.abort();
  }, []);
  const chosen = products?.find((item) => item.id === product);
  const available = (products || []).filter((item) => item.active);
  // El producto guardado sigue a la vista aunque esté desactivado: así se entiende por qué no hay botón.
  const options = chosen && !chosen.active ? [...available, chosen] : available;
  const stocked = !!chosen?.track_stock;
  return (
    <section className="panel padded">
      <p className="helper">
        Para cobrar una sesión suelta no hace falta elegir socio, así que se cobra como producto del catálogo. Crea el
        producto «Sesión» con su precio en <a href="#pos">Caja y planes → Productos</a> y elígelo aquí.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {!products && !error && <Skeleton rows={2} label="Cargando el catálogo" />}
      {products && !options.length && !error && (
        <p className="helper">
          Todavía no hay productos activos. Crea primero el producto de la sesión en{' '}
          <a href="#pos">Caja y planes → Productos</a>.
        </p>
      )}
      {products && !!options.length && (
        <Form
          label="Guardar cambios"
          submitDisabled={enabled && !product}
          onSubmit={async () => {
            if (enabled && !product) throw Error('Elige el producto que se cobra como sesión.');
            await api('settings', 'PATCH', {
              quick_session_product_id: enabled ? product : null,
              quick_session_payment_method: method,
            });
            await saved();
          }}
        >
          <div className="check-list">
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />{' '}
              Vender sesión con un botón en Inicio
            </label>
          </div>
          {enabled && (
            <>
              <Field
                label="¿Qué se cobra?"
                hint="El botón vende una unidad de este producto, con su precio del catálogo."
              >
                <select value={product} onChange={(event) => setProduct(event.target.value)} required>
                  <option value="">Elige un producto</option>
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {money(item.price_cents)}
                      {item.active ? '' : ' · desactivado'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="¿Cómo se cobra?" hint="Queda registrado así en las ventas y los informes.">
                <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                  {Object.entries(methods).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {stocked && (
                <p className="helper">
                  Este producto controla existencias: cada sesión vendida descuenta una unidad y el botón deja de
                  funcionar al quedarse sin stock. Para una sesión conviene un producto sin control de existencias.
                </p>
              )}
              {chosen && !chosen.active && (
                <p className="error-message" role="alert">
                  Este producto está desactivado, así que el botón no aparece en Inicio. Actívalo en Caja y planes →
                  Productos o elige otro producto.
                </p>
              )}
              {!!chosen?.active && (
                <p className="helper">
                  En Inicio aparecerá <strong>Vender sesión · {money(chosen.price_cents)}</strong>. Cada toque registra
                  una venta sin socio, que se suma a la caja y a los informes. Si te equivocas, anula la venta en{' '}
                  <a href="#pos">Caja y planes → Ventas hechas</a>.
                </p>
              )}
            </>
          )}
        </Form>
      )}
    </section>
  );
}
