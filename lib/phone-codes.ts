/**
 * Códigos de país para el WhatsApp de los socios. El número se guarda sin signos,
 * como `59171234567`, que es lo que valida el servidor y lo que entiende `wa.me`.
 */
export const defaultPhoneCode = '591';

export type PhoneCode = { code: string; name: string };

export const phoneCodes: PhoneCode[] = [
  { code: '591', name: 'Bolivia' },
  { code: '54', name: 'Argentina' },
  { code: '55', name: 'Brasil' },
  { code: '56', name: 'Chile' },
  { code: '57', name: 'Colombia' },
  { code: '506', name: 'Costa Rica' },
  { code: '53', name: 'Cuba' },
  { code: '593', name: 'Ecuador' },
  { code: '503', name: 'El Salvador' },
  { code: '34', name: 'España' },
  { code: '1', name: 'Estados Unidos y Canadá' },
  { code: '502', name: 'Guatemala' },
  { code: '504', name: 'Honduras' },
  { code: '52', name: 'México' },
  { code: '505', name: 'Nicaragua' },
  { code: '507', name: 'Panamá' },
  { code: '595', name: 'Paraguay' },
  { code: '51', name: 'Perú' },
  { code: '351', name: 'Portugal' },
  { code: '1809', name: 'República Dominicana' },
  { code: '598', name: 'Uruguay' },
  { code: '58', name: 'Venezuela' },
];

/**
 * Separa un número guardado en código de país y resto. Compara primero los códigos
 * más largos: `1809` tiene que ganarle a `1`, y `591` a `59`.
 *
 * Un número guardado que no empiece por ningún código conocido se devuelve entero,
 * con el código vacío. Así editar otro campo de la ficha no le antepone `591` y
 * cambia el número del socio sin que nadie lo pida; la pantalla lo marca para corregirlo.
 */
export function splitPhone(value: string | undefined | null): { code: string; national: string } {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return { code: defaultPhoneCode, national: '' };
  const match = [...phoneCodes]
    .sort((a, b) => b.code.length - a.code.length)
    .find((entry) => digits.startsWith(entry.code) && digits.length > entry.code.length);
  return match ? { code: match.code, national: digits.slice(match.code.length) } : { code: '', national: digits };
}

/** Une código y número en el formato que se guarda. Devuelve '' si no hay número. */
export function joinPhone(code: string, national: string) {
  const rest = String(national ?? '').replace(/\D/g, '');
  return rest ? String(code ?? '').replace(/\D/g, '') + rest : '';
}
