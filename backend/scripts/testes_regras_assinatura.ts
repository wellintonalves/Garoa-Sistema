import assert from 'node:assert/strict';
import {
  LIMITES_PLANO_BASICO,
  avaliarDowngradeParaBasico,
  avaliarMudancaPeriodicidade,
  avaliarPagamentoRecusado,
  calcularFimConsultaExportacao,
  calcularFimCiclo,
  calcularFimTeste,
  calcularUpgradeProporcional,
  deveAvisarLimiteClientes,
  obterPrecoCiclo,
  podeEscreverNaAssinatura,
  reajustePodeVigorar,
} from '../src/domain/assinatura/regrasAssinatura';

assert.equal(obterPrecoCiclo('BASICO', 'MENSAL'), 3999);
assert.equal(obterPrecoCiclo('BASICO', 'ANUAL'), 39990);
assert.equal(obterPrecoCiclo('PRO', 'MENSAL'), 6999);
assert.equal(obterPrecoCiclo('PRO', 'ANUAL'), 69990);
assert.deepEqual(LIMITES_PLANO_BASICO, { barbeirosAtivos: 8, clientesAtivos: 200, avisoClientesAtivos: 180 });

const inicio = new Date('2026-01-01T12:00:00Z');
assert.equal(calcularFimTeste(inicio).toISOString(), '2026-01-08T12:00:00.000Z');
assert.equal(calcularFimConsultaExportacao(inicio).toISOString(), '2026-01-31T12:00:00.000Z');

const upgrade = calcularUpgradeProporcional({
  planoAtual: 'BASICO', planoDestino: 'PRO', periodicidade: 'MENSAL',
  cicloInicio: new Date('2026-09-01T00:00:00Z'),
  cicloFim: new Date('2026-10-01T00:00:00Z'),
  agora: new Date('2026-09-16T00:00:00Z'),
  cicloPago: true,
});
assert.equal(upgrade.valorAdicionalCentavos, 1500);
assert.throws(() => calcularUpgradeProporcional({
  planoAtual: 'BASICO', planoDestino: 'PRO', periodicidade: 'MENSAL',
  cicloInicio: new Date('2026-09-01T00:00:00Z'), cicloFim: new Date('2026-10-01T00:00:00Z'),
  agora: new Date('2026-09-16T00:00:00Z'), cicloPago: false,
}), /ciclo já pago/);

assert.equal(avaliarDowngradeParaBasico({ barbeirosAtivos: 8, clientesAtivos: 200, chegouRenovacao: false }).acao, 'AGENDAR_DOWNGRADE');
const foraDoLimite = avaliarDowngradeParaBasico({ barbeirosAtivos: 9, clientesAtivos: 205, chegouRenovacao: true });
assert.equal(foraDoLimite.acao, 'ENCERRAR_RENOVACAO');
assert.deepEqual(foraDoLimite.excedentes, { barbeiros: 1, clientes: 5 });

const periodicidade = avaliarMudancaPeriodicidade({ plano: 'BASICO', periodicidadeAtual: 'MENSAL', periodicidadeDestino: 'ANUAL', chegouRenovacao: false });
assert.deepEqual(periodicidade, { precoAtualCentavos: 3999, precoDestinoCentavos: 39990, acao: 'AGENDAR_PARA_RENOVACAO' });

assert.equal(deveAvisarLimiteClientes(179), false);
assert.equal(deveAvisarLimiteClientes(180), true);
assert.equal(deveAvisarLimiteClientes(199), true);
assert.equal(deveAvisarLimiteClientes(200), false);

const aviso = new Date('2026-09-01T12:00:00Z');
assert.equal(avaliarPagamentoRecusado({ avisoEnviadoEm: aviso, agora: new Date('2026-09-07T12:00:00Z'), fatura: 'PENDENTE' }).acao, 'AGUARDAR_REGULARIZACAO');
assert.equal(avaliarPagamentoRecusado({ avisoEnviadoEm: aviso, agora: new Date('2026-09-08T12:00:00Z'), fatura: 'PAGA' }).acao, 'MANTER_ACESSO_PAGAMENTO_CONFIRMADO');
const recusado = avaliarPagamentoRecusado({ avisoEnviadoEm: aviso, agora: new Date('2026-09-08T12:00:00Z'), fatura: 'PENDENTE' });
assert.equal(recusado.acao, 'ENCERRAR_RENOVACAO_E_CANCELAR_FATURA');
assert.equal(recusado.gerarDividaAssinatura, false);
assert.equal(recusado.consultaExportacaoAte?.toISOString(), '2026-10-08T12:00:00.000Z');

assert.equal(reajustePodeVigorar({ avisoEm: new Date('2026-09-01T00:00:00Z'), renovacaoEm: new Date('2026-09-30T00:00:00Z') }), false);
assert.equal(reajustePodeVigorar({ avisoEm: new Date('2026-09-01T00:00:00Z'), renovacaoEm: new Date('2026-10-01T00:00:00Z') }), true);
assert.equal(podeEscreverNaAssinatura({ status: 'ATIVA', agora: inicio, cicloFim: calcularFimCiclo(inicio, 'MENSAL') }), true);
assert.equal(podeEscreverNaAssinatura({ status: 'CONSULTA_EXPORTACAO', agora: inicio }), false);
assert.equal(podeEscreverNaAssinatura({ status: 'ENCERRADA', agora: inicio }), false);
assert.equal(podeEscreverNaAssinatura({ status: 'ATIVA', agora: inicio, fimAcessoEm: inicio }), false);

console.log('✅ Regras de assinatura: preços, teste, upgrade, downgrade, periodicidade, limites, recusa, reajuste e leitura.');

