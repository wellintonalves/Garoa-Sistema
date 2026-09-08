// Utilitários auxiliares de manipulação de entidades de agendamento / itens

interface CatalogoServico {
  nome: string;
  preco: number;
  duracaoMinutos: number;
}

export interface ItemAtendimentoMapeado {
  servicoId: string | null;
  nome: string;
  preco: number;
  duracaoMinutos: number;
  congelado: boolean;
}

/**
 * Função unificada para extrair os itens prestados em um atendimento (Agendamento ou Lançamento).
 * Preserva o conceito de "preço congelado" quando os itens já foram persistidos na tabela ItemAtendimento.
 * 
 * @param entidade Agendamento ou Lançamento (precisa ter recebido o include de itens, ou os campos antigos servicosIds/servicoId)
 * @param catalogoPorId Map do catálogo atual para resgate dos dados (Plano B e C)
 * @returns Array de itens com as informações de nome, preço, duração e flag `congelado`.
 */
export function obterItensDoAtendimento(
  entidade: any,
  catalogoPorId: Map<string, CatalogoServico>
): ItemAtendimentoMapeado[] {
  // 1. Prioridade máxima: Tabela de Itens (se vier no include)
  if (entidade.itens && entidade.itens.length > 0) {
    return entidade.itens.map((i: any) => ({
      servicoId: i.servicoId,
      nome: i.nome,
      preco: Number(i.preco),
      duracaoMinutos: i.duracaoMinutos,
      congelado: true,
    }));
  }

  // Se não tem itens, levanta IDs do legado para o Plano B ou C
  let idsLegado: string[] = [];
  if (entidade.servicosIds && entidade.servicosIds.length > 0) {
    idsLegado = entidade.servicosIds;
  } else if (entidade.servicoId) {
    idsLegado = [entidade.servicoId];
  }

  if (idsLegado.length === 0) {
    console.error(`[ERRO LOG] Entidade ${entidade.id || 'desconhecida'} não possui serviços registrados (falha nas 3 tentativas).`);
    return [];
  }

  // Resolve os IDs pelo catálogo
  return idsLegado.map(id => {
    const s = catalogoPorId.get(id);
    if (!s) {
      console.error(`[ERRO LOG] Entidade ${entidade.id || 'desconhecida'} tentou ler serviço ID ${id} mas não está no catálogo.`);
      return {
        servicoId: id,
        nome: `Serviço Indisponível`,
        preco: 0,
        duracaoMinutos: 0,
        congelado: false
      };
    }

    return {
      servicoId: id,
      nome: s.nome,
      preco: Number(s.preco),
      duracaoMinutos: s.duracaoMinutos,
      congelado: false
    };
  });
}

/**
 * Função utilitária de conveniência apenas para extrair os IDs (quando a operação só necessita saber os identificadores).
 */
export function obterIdsServicosAgendamento(
  entidade: any,
  catalogoPorId?: Map<string, CatalogoServico>
): string[] {
  // Se não foi passado catálogo, vamos tentar só puxar os IDs puramente dos campos disponíveis (fallback temporário)
  if (!catalogoPorId) {
     if (entidade.itens && entidade.itens.length > 0) return entidade.itens.map((i: any) => i.servicoId).filter(Boolean);
     if (entidade.servicosIds && entidade.servicosIds.length > 0) return entidade.servicosIds;
     if (entidade.servicoId) return [entidade.servicoId];
     return [];
  }

  return obterItensDoAtendimento(entidade, catalogoPorId)
    .map(i => i.servicoId)
    .filter((id): id is string => id !== null);
}
