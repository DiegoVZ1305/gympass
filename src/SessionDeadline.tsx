import { Field } from './ui';

export default function SessionDeadline({ start, value, onChange }: {
  start: string; value: string; onChange: (value: string) => void;
}) {
  return <Field label="Fecha límite de las sesiones" hint="Último día incluido. Al vencer, las sesiones restantes dejan de permitir entradas.">
    <input type="date" required min={start} value={value} onChange={(event) => onChange(event.target.value)} />
  </Field>;
}
