import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPhone, joinPhone, phoneCodes, defaultPhoneCode } from '../lib/phone-codes.ts';

test('un número vacío empieza en Bolivia y no inventa dígitos', () => {
  assert.deepEqual(splitPhone(''), { code: '591', national: '' });
  assert.deepEqual(splitPhone(null), { code: '591', national: '' });
  assert.equal(defaultPhoneCode, '591');
  assert.equal(joinPhone('591', ''), '');
});

test('separa el código de país y gana el más largo', () => {
  assert.deepEqual(splitPhone('59171234567'), { code: '591', national: '71234567' });
  assert.deepEqual(splitPhone('5491123456789'), { code: '54', national: '91123456789' });
  // 1809 debe ganarle a 1, y 591 a 59.
  assert.deepEqual(splitPhone('18095551234'), { code: '1809', national: '5551234' });
  assert.deepEqual(splitPhone('12125551234'), { code: '1', national: '2125551234' });
});

test('un número sin código reconocible se conserva entero en vez de recibir el 591', () => {
  // Al editar otro campo de la ficha, el número del socio no puede cambiar solo.
  const split = splitPhone('323111232');
  assert.equal(split.code, '');
  assert.equal(split.national, '323111232');
  assert.equal(joinPhone(split.code, split.national), '323111232');
});

test('une código y número descartando signos y espacios', () => {
  assert.equal(joinPhone('591', '7 123 45-67'), '59171234567');
  assert.equal(joinPhone('+591', '71234567'), '59171234567');
});

test('todo número armado con la lista pasa la validación del servidor', () => {
  // El servidor exige /^[1-9]\d{8,14}$/ para el WhatsApp de un socio.
  for (const entry of phoneCodes) {
    const value = joinPhone(entry.code, '71234567');
    assert.match(value, /^[1-9]\d{8,14}$/, entry.name);
    assert.deepEqual(splitPhone(value).code, entry.code, entry.name);
  }
});

test('los códigos son dígitos y no se repiten', () => {
  const seen = new Set<string>();
  for (const entry of phoneCodes) {
    assert.match(entry.code, /^[1-9]\d{0,3}$/, entry.name);
    assert.ok(entry.name.trim().length > 0);
    assert.ok(!seen.has(entry.code), 'código repetido: ' + entry.code);
    seen.add(entry.code);
  }
  assert.ok(seen.has(defaultPhoneCode));
});
