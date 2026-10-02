// Serviço de serviços da barbearia — CRUD completo
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { objetoPermitido, texto, numero, booleano } from '../utils/entradaSegura.util';

interface DadosServico {
  nome: string;
  descricao?: string;
  preco: number;
  duracaoMinutos: number;
  comissaoPercent?: number;
  cor?: string;
}

export class ServicoService {
  /** Lista todos os serviços ativos */
  static async listarTodos(barbeariaId?: string) {
    if (barbeariaId) {
      // Auto-correção: associa serviços órfãos à barbearia atual
      await prisma.servico.updateMany({
        where: { barbeariaId: null },
        data: { barbeariaId },
      });
    }

    return prisma.servico.findMany({
      where: { ativo: true, ...(barbeariaId ? { barbeariaId } : {}) },
      orderBy: { nome: 'asc' },
    });
  }

  /** Busca serviço por ID */
  static async buscarPorId(id: string) {
    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) throw new Error('Serviço não encontrado');
    return servico;
  }

  /** Cria um novo serviço */
  static async criar(dados: DadosServico, barbeariaId?: string) {
    return prisma.servico.create({
      data: {
        nome: dados.nome,
        descricao: dados.descricao,
        preco: dados.preco,
        duracaoMinutos: dados.duracaoMinutos,
        comissaoPercent: dados.comissaoPercent ?? 50,
        cor: dados.cor || '#22C55E',
        barbeariaId: barbeariaId || null,
      } as any,
    });
  }

  /** Atualiza um serviço */
  static async atualizar(id: string, entrada: Partial<DadosServico & { ativo: boolean }>) {
    const dados = objetoPermitido(entrada, ['nome', 'descricao', 'preco', 'duracaoMinutos', 'comissaoPercent', 'cor', 'ativo']);
    const data: Prisma.ServicoUpdateInput = {};
    if (dados.nome !== undefined) data.nome = texto(dados.nome);
    if (dados.descricao !== undefined) data.descricao = texto(dados.descricao, 4000, true);
    if (dados.preco !== undefined) data.preco = numero(dados.preco, 99999999.99);
    if (dados.duracaoMinutos !== undefined) data.duracaoMinutos = numero(dados.duracaoMinutos, 1440, true);
    if (dados.comissaoPercent !== undefined) data.comissaoPercent = numero(dados.comissaoPercent, 100);
    if (dados.cor !== undefined) data.cor = texto(dados.cor, 100);
    if (dados.ativo !== undefined) data.ativo = booleano(dados.ativo);
    return prisma.servico.update({
      where: { id },
      data,
    });
  }

  /** Desativa um serviço (soft delete) */
  static async desativar(id: string, barbeariaId?: string) {
    if (!barbeariaId) throw new Error('Barbearia não identificada');

    const servico = await prisma.servico.findFirst({
      where: { id, barbeariaId },
      select: { id: true },
    });
    if (!servico) throw new Error('Serviço não encontrado');

    return prisma.servico.update({
      where: { id: servico.id },
      data: { ativo: false } as any,
    });
  }
}
