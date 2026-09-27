import { PrismaClient } from '@prisma/client';
import { ContextoIa } from './cotas';
import { ErroDeNegocio } from '../../lib/erros';

export const ferramentaComissoes = {
  type: 'function', name: 'consultar_regras_comissao', strict: true,
  description: 'Lê as taxas atuais de comissão de serviços dos barbeiros autorizados e a base de cálculo. Perguntas qual a porcentagem dos barbeiros ou quanto fulano ganha de comissão pedem dados, não tutorial. Admin consulta sua equipe; barbeiro somente a própria taxa. Não calcula histórico, pagamentos ou saldo. Não há comissão de produtos no fluxo de vendas.',
  parameters: { type: 'object', additionalProperties: false, properties: {
    barbeiro: { type: ['string', 'null'], description: 'Nome exato do profissional ou null para todos os autorizados. No perfil barbeiro, null significa somente ele mesmo.' },
  }, required: ['barbeiro'] },
};

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function pedeDadosComissao(mensagem: string) {
  const m = normalizar(mensagem);
  if (!/\b(comiss(?:ao|oes)|porcentagem|percentua(?:l|is)|taxa)\b/.test(m)) return false;
  // Localizar/configurar uma tela é ajuda, mesmo que mencione um percentual.
  if (/\b(onde|qual (?:tela|aba|menu|botao)|o que significa)\b/.test(m)
    || /\bcomo\b.*\b(faco|configur\w*|alter\w*|mud\w*|edit\w*|cadastr\w*|vej\w*|ver|consult\w*|acess\w*)\b/.test(m)
    || /\b(configurar|alterar|editar|mudar|cadastrar)\b/.test(m)) return false;
  // Valor gerado/pago em um período não é a taxa atual.
  if (/\b(pag[ao]s?|receb(?:eu|ido)|saldo|gerad[ao]|acumulad[ao]|devo|mes|semana|ontem|periodo|historico)\b/.test(m)) return false;
  return true;
}

export async function consultarComissoes(db: PrismaClient, c: ContextoIa, args: unknown, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!['ADMIN', 'BARBEIRO'].includes(c.papel)) throw new ErroDeNegocio('Você não tem acesso às regras de remuneração da equipe.', 403);
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 1 || !('barbeiro' in args) ||
    (args.barbeiro !== null && (typeof args.barbeiro !== 'string' || !args.barbeiro.trim() || args.barbeiro.length > 200))) throw new ErroDeNegocio('Informe um nome válido ou consulte todos os profissionais autorizados.');
  const nome = typeof args.barbeiro === 'string' ? args.barbeiro.trim() : null;
  return db.$transaction(async tx => {
    const autorizado = await tx.usuario.findFirst({ where: { id: c.usuarioId, papel: c.papel, barbeariaId: c.barbeariaId, barbearia: { ativo: true } }, select: { id: true } });
    if (!autorizado) throw new ErroDeNegocio('Acesso não autorizado às comissões.', 403);
    const proprio = c.papel === 'BARBEIRO' ? await tx.barbeiro.findFirst({ where: { usuarioId: c.usuarioId, barbeariaId: c.barbeariaId, ativo: true }, select: { id: true, usuario: { select: { nome: true } } } }) : null;
    if (c.papel === 'BARBEIRO' && (!proprio || (nome && nome.toLowerCase() !== proprio.usuario.nome.toLowerCase()))) throw new ErroDeNegocio('Você só pode consultar a sua própria regra de comissão.', 403);
    const profissionais = await tx.barbeiro.findMany({ where: { barbeariaId: c.barbeariaId,
      ...(proprio ? { id: proprio.id } : {}), usuario: { barbeariaId: c.barbeariaId, ...(nome ? { nome: { equals: nome, mode: 'insensitive' as const } } : {}) } },
      select: { ativo: true, comissaoPercent: true, usuario: { select: { nome: true } } }, orderBy: { id: 'asc' }, take: 51 });
    if (nome && profissionais.length > 1) throw new ErroDeNegocio('Há profissionais com o mesmo nome. Não é seguro escolher um; confira o cadastro desejado na tela de Barbeiros.');
    if (profissionais.length > 50) throw new ErroDeNegocio('Há mais de 50 profissionais. Informe o nome completo para consultar a taxa; nenhum resultado parcial foi apresentado.');
    const config = await tx.configuracao.findUnique({ where: { barbeariaId: c.barbeariaId }, select: { baseCalculoComissao: true } });
    signal?.throwIfAborted();
    const resultado = { estado: profissionais.length ? 'DADOS' : 'SEM_REGISTROS', escopo: proprio ? 'Somente o profissional autenticado' : 'Equipe da barbearia autenticada, incluindo inativos identificados',
      tipo: 'Configuração atual de comissão de serviços, não valor recebido ou pago',
      profissionais: profissionais.map(p => ({ nome: p.usuario.nome, ativo: p.ativo,
        percentualServicos: Number.isFinite(p.comissaoPercent) && p.comissaoPercent >= 0 && p.comissaoPercent <= 100 ? p.comissaoPercent : null })),
      baseServicos: config?.baseCalculoComissao ?? null,
      significadoBase: config ? config.baseCalculoComissao === 'VALOR_BRUTO' ? 'Antes dos descontos' : 'Após os descontos, antes de retirar a comissão' : 'Configuração geral ausente; não é possível afirmar uma base única para todos os fluxos',
      produtos: { comissaoAplicadaNaVenda: false, percentual: null, explicacao: 'A venda de produtos não atribui comissão a barbeiro; ausência de regra não é taxa cadastrada de 0%.' },
      limites: ['0% é uma taxa válida; null indica dado ausente ou inválido. Não aplicar um percentual padrão.',
        'Os fechamentos de serviços usam a taxa do barbeiro. O campo de taxa no catálogo de serviços não é usado como exceção nesses fechamentos; não há regra aplicada de valor fixo ou exceção por serviço/produto/profissional além da taxa individual.',
        'Não recalcular histórico com a taxa atual. Comissões geradas usam os snapshots dos lançamentos; pagamento e saldo exigem registros próprios que esta ferramenta não consulta.',
        ...(nome && !profissionais.length ? ['Não foi encontrado profissional com esse nome neste acesso.'] : !profissionais.length ? ['Não existem registros de barbeiros disponíveis neste acesso.'] : [])] };
    if (Buffer.byteLength(JSON.stringify(resultado), 'utf8') > 8000) throw new ErroDeNegocio('A lista excede o limite da consulta. Informe o nome completo de um profissional.');
    return resultado;
  }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
}
