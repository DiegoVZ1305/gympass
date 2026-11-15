export const sessionPlanColumns = [
  { name: 'session_period_unit', type: 'TEXT', sql: "TEXT NOT NULL DEFAULT 'months' CHECK(session_period_unit IN ('days','months'))", value: 'months' },
  { name: 'session_period', type: 'INTEGER', sql: 'INTEGER NOT NULL DEFAULT 1 CHECK(session_period BETWEEN 1 AND 3660)', value: 1 },
] as const;
