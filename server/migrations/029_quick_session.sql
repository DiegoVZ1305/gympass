-- Venta rápida de sesión: el botón de Inicio cobra este producto sin elegir socio.
-- NULL deja el botón oculto, que es como siguen los gimnasios que ya operan.
ALTER TABLE settings ADD COLUMN quick_session_product_id TEXT REFERENCES pos_products(id);
ALTER TABLE settings ADD COLUMN quick_session_payment_method TEXT NOT NULL DEFAULT 'cash'
  CHECK(quick_session_payment_method IN ('cash','transfer','card'));
