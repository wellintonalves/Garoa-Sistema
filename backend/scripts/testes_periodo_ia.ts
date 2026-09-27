import assert from 'node:assert/strict';
import { calcularFimCiclo } from '../src/domain/assinatura/regrasAssinatura';
import { AssinaturaParaPeriodoIa, identificarPeriodoIa, prepararFranquiaIa } from '../src/services/ia/periodo';
import { configuracaoIa } from '../src/services/ia/politica';
import { decidirSupervisaoVoz } from '../src/services/ia/supervisaoVoz';

const inicio = new Date('2028-01-31T03:00:00.000Z'); // meia-noite em São Paulo
const fim = calcularFimCiclo(inicio, 'MENSAL');
const assinatura: AssinaturaParaPeriodoIa = {
  id: 'assinatura-a', barbeariaId: 'tenant-a', periodicidade: 'MENSAL', status: 'ATIVA',
  cicloInicio: inicio, cicloFim: fim, fimAcessoEm: null,
};
assert.equal(fim.toISOString(), '2028-02-29T03:00:00.000Z');
assert.equal(configuracaoIa({ IA_RENOVACAO: 'MES_CALENDARIO' }).renovacao, 'CICLO_MENSAL_ASSINATURA');
assert.equal(configuracaoIa({}).acumulaSaldo, false);

const periodo = identificarPeriodoIa(assinatura, inicio);
assert.equal(periodo.estado, 'IDENTIFICADO');
if (periodo.estado !== 'IDENTIFICADO') throw new Error('Ciclo mensal não identificado.');
const limites = { mensagens: 100, segundosVoz: 0, creditos: null };
const franquia = prepararFranquiaIa(periodo, limites);
assert.equal(franquia.mensagensLimite, 100);
assert.equal(franquia.configuracaoCustoPendente, true);
assert.equal(franquia.acumulaSaldo, false);
assert.deepEqual(prepararFranquiaIa(periodo, limites), franquia); // repetição não muda identidade
assert.throws(() => prepararFranquiaIa(periodo, { ...limites, mensagens: -1 }));
assert.throws(() => prepararFranquiaIa(periodo, { ...limites, creditos: Infinity }));
// Instantes de fronteira são [início, fim), sem graça implícita.
assert.deepEqual(identificarPeriodoIa(assinatura, new Date(inicio.getTime() - 1)), { estado: 'PENDENTE', motivo: 'FORA_DO_CICLO' });
assert.equal(identificarPeriodoIa(assinatura, new Date(fim.getTime() - 1)).estado, 'IDENTIFICADO');
assert.deepEqual(identificarPeriodoIa(assinatura, fim), { estado: 'PENDENTE', motivo: 'FORA_DO_CICLO' });
// Só um ciclo posterior já confirmado abre a possibilidade de nova franquia.
const seguinte = identificarPeriodoIa({ ...assinatura, cicloInicio: fim, cicloFim: calcularFimCiclo(fim, 'MENSAL') }, fim);
if (seguinte.estado !== 'IDENTIFICADO') throw new Error('Novo ciclo não identificado.');
assert.notEqual(seguinte.inicio.getTime(), periodo.inicio.getTime());
assert.equal(prepararFranquiaIa(seguinte, limites).mensagensLimite, 100); // sem somar saldo anterior
assert.equal(seguinte.fim.toISOString(), '2028-03-29T03:00:00.000Z'); // segue ciclo real, sem inventar dia 31
// Ano não bissexto e virada de ano usam exatamente a função financeira existente.
for (const iso of ['2027-01-31T03:00:00.000Z', '2027-12-31T03:00:00.000Z']) {
  const data = new Date(iso);
  assert.equal(identificarPeriodoIa({ ...assinatura, cicloInicio: data, cicloFim: calcularFimCiclo(data, 'MENSAL') }, data).estado, 'IDENTIFICADO');
}
// Periodicidade trocada antes de novo pagamento não pode validar datas anuais como mensais.
assert.deepEqual(identificarPeriodoIa({ ...assinatura, cicloFim: calcularFimCiclo(inicio, 'ANUAL') }, inicio), { estado: 'PENDENTE', motivo: 'CICLO_INVALIDO' });
assert.deepEqual(identificarPeriodoIa({ ...assinatura, periodicidade: 'ANUAL' }, inicio), { estado: 'PENDENTE', motivo: 'ANUAL_AGUARDA_POLITICA' });
assert.deepEqual(identificarPeriodoIa({ ...assinatura, status: 'TESTE' }, inicio), { estado: 'PENDENTE', motivo: 'TESTE_AGUARDA_POLITICA' });
assert.deepEqual(identificarPeriodoIa({ ...assinatura, status: 'PAGAMENTO_PENDENTE' }, inicio), { estado: 'PENDENTE', motivo: 'PAGAMENTO_AGUARDA_POLITICA' });
assert.deepEqual(identificarPeriodoIa({ ...assinatura, fimAcessoEm: inicio }, inicio), { estado: 'PENDENTE', motivo: 'FORA_DO_CICLO' });
assert.deepEqual(identificarPeriodoIa({ ...assinatura, cicloInicio: null }, inicio), { estado: 'PENDENTE', motivo: 'CICLO_INVALIDO' });
assert.deepEqual(identificarPeriodoIa(null, inicio), { estado: 'PENDENTE', motivo: 'SEM_ASSINATURA' });
assert.throws(() => identificarPeriodoIa(assinatura, new Date('inválida')));
// Snapshot não retém referências mutáveis às datas financeiras.
periodo.inicio.setTime(0);
assert.equal(assinatura.cicloInicio!.toISOString(), '2028-01-31T03:00:00.000Z');
assert.equal(franquia.inicio.toISOString(), '2028-01-31T03:00:00.000Z');

const voz = { agoraMs: 44_999, ultimaAtividadeMs: 0, encerrarAteMs: 1_800_000, ocupada: false, conexaoPerdida: false };
assert.deepEqual(decidirSupervisaoVoz(voz), { acao: 'continuar' });
assert.deepEqual(decidirSupervisaoVoz({ ...voz, agoraMs: 45_000 }), { acao: 'avisar' });
assert.deepEqual(decidirSupervisaoVoz({ ...voz, agoraMs: 60_000 }), { acao: 'encerrar', motivo: 'INATIVIDADE' });
assert.deepEqual(decidirSupervisaoVoz({ ...voz, agoraMs: 90_000, ocupada: true }), { acao: 'continuar' });
assert.deepEqual(decidirSupervisaoVoz({ ...voz, agoraMs: 1_800_000, ocupada: true }), { acao: 'encerrar', motivo: 'LIMITE_RESERVADO' });
assert.deepEqual(decidirSupervisaoVoz({ ...voz, conexaoPerdida: true }), { acao: 'encerrar', motivo: 'CONEXAO_PERDIDA' });
assert.deepEqual(decidirSupervisaoVoz({ ...voz, ultimaAtividadeMs: 90_000 }), { acao: 'encerrar', motivo: 'ESTADO_INVALIDO' });
console.log('IA: ciclos reais, renovação sem acúmulo, pendências comerciais e supervisão de voz passaram.');
