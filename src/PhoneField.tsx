import { useId, useState } from 'react';
import { phoneCodes, splitPhone, joinPhone, defaultPhoneCode } from '../lib/phone-codes';

/**
 * Código de país y número en dos controles. El valor que viaja en el formulario es
 * un campo oculto con los dígitos unidos, así que quien reciba el formulario no cambia.
 *
 * No se usa `Field` porque ese componente clona un único control para enlazar su etiqueta,
 * y aquí hay dos.
 */
export default function PhoneField({
  label = 'WhatsApp',
  name = 'phone',
  defaultValue,
  required = false,
  hint = 'Elige el país y escribe el número sin el código. Por defecto Bolivia (+591).',
}: {
  label?: string;
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
  hint?: string;
}) {
  const id = useId();
  const initial = splitPhone(defaultValue);
  const [code, setCode] = useState(initial.code);
  const [national, setNational] = useState(initial.national);
  // Un numero guardado sin codigo reconocible se conserva entero y se marca,
  // en vez de anteponerle el codigo por defecto y cambiarlo sin aviso.
  const unknown = code === '';

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="phone-input">
        <select
          aria-label="Código de país"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        >
          {unknown && <option value="">Sin código de país</option>}
          {phoneCodes.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.name + ' +' + entry.code}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={20}
          required={required}
          aria-describedby={hint ? id + '-hint' : undefined}
          placeholder="71234567"
          value={national}
          onChange={(event) => setNational(event.target.value.replace(/\D/g, ''))}
        />
      </div>
      <input type="hidden" name={name} value={joinPhone(code, national)} />
      {unknown && national && (
        <small className="warning-text" role="status">
          Este número está guardado sin código de país, así que WhatsApp no abrirá su chat. Elige el país
          y deja solo el número.
        </small>
      )}
      {hint && <small id={id + '-hint'}>{hint}</small>}
    </div>
  );
}

export { defaultPhoneCode };
