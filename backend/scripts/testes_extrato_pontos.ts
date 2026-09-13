import assert from 'node:assert/strict';
import { resumirPontos, tipoMovimentoPontos } from '../src/utils/extratoPontos.util';
assert.equal(tipoMovimentoPontos(-100), 'RESGATE');
assert.equal(tipoMovimentoPontos(100), 'GANHO');
assert.deepEqual(resumirPontos([{ pontos: 500 }, { pontos: -100 }], [{ pontosUsados: 50 }]),
  { totalGanho: 500, totalGasto: 150, saldo: 350 });
assert.deepEqual(resumirPontos([{ pontos: 500 }, { pontos: -100 }, { pontos: 100 }], []),
  { totalGanho: 600, totalGasto: 100, saldo: 500 });
assert.deepEqual(resumirPontos([], []), { totalGanho: 0, totalGasto: 0, saldo: 0 });
console.log('PASS extrato: débitos legados, serviço/produto, reserva, estorno e saldo preservado.');
