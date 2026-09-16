import assert from 'node:assert/strict';
import { calcularIdade, normalizarDataNascimento } from '../src/utils/dataNascimento.util';

function deveFalhar(valor: string, trecho: string) {
  assert.throws(() => normalizarDataNascimento(valor), (erro: unknown) => {
    return erro instanceof Error && erro.message.includes(trecho);
  });
}

const nascimento = normalizarDataNascimento('2000-02-29');
assert.equal(nascimento.toISOString(), '2000-02-29T12:00:00.000Z');

deveFalhar('2001-02-29', 'válida');
deveFalhar('31/12/2000', 'válida');

const amanha = new Date();
amanha.setUTCDate(amanha.getUTCDate() + 1);
deveFalhar(amanha.toISOString().slice(0, 10), 'futuro');

assert.equal(calcularIdade(null, new Date('2026-09-15T12:00:00Z')), null);
assert.equal(calcularIdade('2000-09-15T12:00:00Z', new Date('2026-09-15T12:00:00Z')), 26);
assert.equal(calcularIdade('2000-09-16T12:00:00Z', new Date('2026-09-15T12:00:00Z')), 25);
assert.equal(calcularIdade('2000-09-14T12:00:00Z', new Date('2026-09-15T12:00:00Z')), 26);
assert.equal(calcularIdade('2000-02-29T12:00:00Z', new Date('2026-02-28T12:00:00Z')), 25);
assert.equal(calcularIdade('2000-02-29T12:00:00Z', new Date('2026-03-01T12:00:00Z')), 26);

console.log('✅ Data de nascimento validada: datas reais, futuro, legados e limites de aniversário.');
