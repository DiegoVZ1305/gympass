-- El plazo pertenece al catálogo. Las membresías ya cobradas conservan su fecha.
ALTER TABLE pos_plans ADD COLUMN session_period_unit TEXT NOT NULL DEFAULT 'months' CHECK(session_period_unit IN ('days','months'));
ALTER TABLE pos_plans ADD COLUMN session_period INTEGER NOT NULL DEFAULT 1 CHECK(session_period BETWEEN 1 AND 3660);
