import assert from 'node:assert/strict';

const chamadas: Array<{ modelo: string; args: any }> = [];
const modelosLista = [
  'barbeiro', 'cliente', 'servico', 'agendamento', 'lancamentoFinanceiro',
  'itemAtendimento', 'estoque', 'vendaEstoque', 'vendaProduto', 'pontoFidelidade',
  'configuracao', 'configuracaoFidelidade', 'recompensa', 'resgateRecompensa',
  'chatMensagem', 'indicacao', 'avaliacao', 'bloqueioAgenda', 'historicoRemarcacao',
  'aprovacaoEdicao',
];
const fake: any = {
  usuario: {
    findFirst: async ({ where, select }: any) => {
      chamadas.push({ modelo: 'usuario-autorizacao', args: { where, select } });
      return where.id === 'admin-a' && where.barbeariaId === 'barbearia-a' ? { id: 'admin-a' } : null;
    },
    findMany: async (args: any) => {
      chamadas.push({ modelo: 'usuario', args });
      return [{ id: 'usuario-a', nome: '=Nome protegido', email: 'cliente@teste.local', papel: 'CLIENTE' }];
    },
  },
  barbearia: {
    findUnique: async (args: any) => {
      chamadas.push({ modelo: 'barbearia', args });
      return { id: args.where.id, nome: 'Barbearia A' };
    },
  },
};
for (const modelo of modelosLista) {
  fake[modelo] = {
    findMany: async (args: any) => {
      chamadas.push({ modelo, args });
      return [{ id: `${modelo}-a`, barbeariaId: 'barbearia-a' }];
    },
  };
}
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

async function main() {
  const { gerarArquivosExportacao, gerarCsv } = await import('../src/services/exportacaoCsv.service');
  const { AssinaturaService } = await import('../src/services/assinatura.service');

  const csv = gerarCsv([
    { nome: '=2+2', email: '+teste@local', observacao: '@comando', seguro: 'texto', menos: '-10' },
  ]);
  assert.match(csv, /"'=2\+2"/);
  assert.match(csv, /"'\+teste@local"/);
  assert.match(csv, /"'@comando"/);
  assert.match(csv, /"'-10"/);
  assert.ok(csv.startsWith('\uFEFF'));

  const volumoso = gerarCsv(Array.from({ length: 10_000 }, (_, indice) => ({ id: indice, nome: `Cliente ${indice}` })));
  assert.equal(volumoso.split('\r\n').length, 10_002);

  await assert.rejects(
    AssinaturaService.exportarDados({ id: 'barbeiro', nome: 'B', email: 'b@x', papel: 'BARBEIRO', barbeariaId: 'barbearia-a' }),
    /Somente o administrador/,
  );
  await assert.rejects(
    AssinaturaService.exportarDados({ id: 'admin-b', nome: 'B', email: 'b@x', papel: 'ADMIN', barbeariaId: 'barbearia-b' }),
    /autorizado não encontrado/,
  );

  const exportacao = await AssinaturaService.exportarDados({
    id: 'admin-a', nome: 'Admin', email: 'admin@a', papel: 'ADMIN', barbeariaId: 'barbearia-a',
  });
  assert.equal(exportacao.barbeariaId, 'barbearia-a');
  const serializado = JSON.stringify(exportacao);
  assert.ok(!serializado.includes('senha'));
  assert.ok(!serializado.includes('token'));
  assert.ok(!serializado.includes('codigoVerificacao'));
  assert.ok(chamadas.filter((chamada) => chamada.modelo !== 'usuario-autorizacao').every((chamada) =>
    JSON.stringify(chamada.args).includes('barbearia-a') || chamada.modelo === 'barbearia'
  ));

  const arquivos = gerarArquivosExportacao(exportacao);
  assert.ok(arquivos.some((arquivo) => arquivo.nome === 'README.txt'));
  assert.ok(arquivos.some((arquivo) => arquivo.nome === 'manifesto.json'));
  assert.ok(arquivos.some((arquivo) => arquivo.nome === 'clientes.csv'));
  assert.ok(arquivos.some((arquivo) => arquivo.nome === 'financeiro.csv') === false, 'nomes refletem categorias reais do pacote');

  console.log('✅ Exportação: RBAC, unidade, segredos excluídos, CSV seguro, manifesto e volume de 10 mil linhas.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
