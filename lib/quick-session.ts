import type { PaymentMethod } from './pos-types.ts';

/** Lo que cobra el botón de Inicio: un producto del catálogo, sin socio ni selección. */
export type QuickSession = {
  product_id: string;
  name: string;
  price_cents: number;
  payment_method: PaymentMethod;
};
/** Columnas de `settings` que añade la migración 029, para completar copias anteriores. */
export const quickSessionColumns = [
  { name: 'quick_session_product_id', value: null, sql: 'TEXT REFERENCES pos_products(id)' },
  {
    name: 'quick_session_payment_method',
    value: 'cash',
    sql: "TEXT NOT NULL DEFAULT 'cash' CHECK(quick_session_payment_method IN ('cash','transfer','card'))",
  },
] as const;
