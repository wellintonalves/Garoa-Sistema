import assert from 'node:assert/strict';
import {
  avaliarRemocaoBackup,
  calcularPrazoRemocaoBackup,
  filtrarReintroducaoEmRestauracao,
} from '../src/domain/privacidade/retencaoBackup';

const exclusao = new Date('2026-09-15T12:00:00Z');
assert.equal(calcularPrazoRemocaoBackup(exclusao).toISOString(), '2026-10-15T12:00:00.000Z');
assert.equal(avaliarRemocaoBackup({ entidade: 'clientes', registroId: '1', excluidoPrincipalEm: null, retencaoLegal: false }, exclusao), 'AGUARDAR_EXCLUSAO_PRINCIPAL');
assert.equal(avaliarRemocaoBackup({ entidade: 'clientes', registroId: '1', excluidoPrincipalEm: exclusao, retencaoLegal: true }, new Date('2027-01-01T00:00:00Z')), 'BLOQUEADA_RETENCAO_LEGAL');
assert.equal(avaliarRemocaoBackup({ entidade: 'clientes', registroId: '1', excluidoPrincipalEm: exclusao, retencaoLegal: false }, new Date('2026-10-14T12:00:00Z')), 'DENTRO_DO_PRAZO');
assert.equal(avaliarRemocaoBackup({ entidade: 'clientes', registroId: '1', excluidoPrincipalEm: exclusao, retencaoLegal: false }, new Date('2026-10-15T12:00:00Z')), 'PRAZO_VENCIDO');

const registros = [{ id: 'manter' }, { id: 'remover' }, { id: 'retencao' }];
const restaurados = filtrarReintroducaoEmRestauracao('clientes', registros, [
  { entidade: 'clientes', registroId: 'remover', excluidoPrincipalEm: exclusao, retencaoLegal: false },
  { entidade: 'clientes', registroId: 'retencao', excluidoPrincipalEm: exclusao, retencaoLegal: true },
  { entidade: 'usuarios', registroId: 'manter', excluidoPrincipalEm: exclusao, retencaoLegal: false },
]);
assert.deepEqual(restaurados, [{ id: 'manter' }, { id: 'retencao' }]);

console.log('✅ Retenção de backup: prazo de 30 dias, retenção legal e proteção contra reintrodução.');
