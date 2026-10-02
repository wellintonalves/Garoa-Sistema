import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { objetoPermitido, texto, booleano } from '../utils/entradaSegura.util';
import { ConfiguracaoService } from '../services/configuracao.service';
import { AuthRequest } from '../types';
import { ErroDeNegocio } from '../lib/erros';
import { validarReferenciaImagemRecebida } from '../services/referenciaImagem.service';

const gerarSlug = (nome: string) => {
  return nome.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const cacheBarbearia: Record<string, { data: any, expira: number }> = {};
export function invalidarCacheBarbearia(id: string): void { delete cacheBarbearia[id]; }

function unidadeDoAdministrador(req: AuthRequest): string {
  if (req.usuario?.papel !== 'ADMIN' || !req.usuario.id || !req.usuario.barbeariaId) {
    throw new ErroDeNegocio('Acesso não autorizado.', 403);
  }
  return req.usuario.barbeariaId;
}

export class ConfiguracaoController {
  /** GET /configuracoes */
  static async obter(req: AuthRequest, res: Response): Promise<void> {
    try {
      const config = await ConfiguracaoService.obter(unidadeDoAdministrador(req));
      res.json(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao obter configurações';
      res.status(error instanceof ErroDeNegocio ? error.status : 500).json({ erro: msg });
    }
  }

  /** PUT /configuracoes */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const config = await ConfiguracaoService.atualizar(req.body, unidadeDoAdministrador(req));
      res.json(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar configurações';
      res.status(error instanceof ErroDeNegocio ? error.status : 400).json({ erro: msg });
    }
  }

  /** GET /configuracoes/minha-barbearia */
  static async getMinhaBarbearia(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = unidadeDoAdministrador(req);
      
      const agora = Date.now();
      if (barbeariaId && cacheBarbearia[barbeariaId] && cacheBarbearia[barbeariaId].expira > agora) {
        res.json(cacheBarbearia[barbeariaId].data);
        return;
      }

      let barbearia = await prisma.barbearia.findUnique({ where: { id: barbeariaId } });
      if (!barbearia) throw new ErroDeNegocio('Barbearia não encontrada.', 404);
      
      // Auto-correção: Atualiza o slug atual diretamente no banco se estiver com o padrão antigo
      if (barbearia && barbearia.slug && barbearia.slug.startsWith('minha-barbearia-')) {
        barbearia = await prisma.barbearia.update({
          where: { id: barbeariaId },
          data: { slug: 'garoa-barbearia' }
        });
      }

      const clientesCount = await prisma.clienteBarbearia.count({ where: { barbeariaId } });

      const payload = { ...barbearia, clientesCount };
      if (barbeariaId) {
        cacheBarbearia[barbeariaId] = { data: payload, expira: agora + 60000 };
      }

      res.json(payload);
    } catch (error) {
      res.status(error instanceof ErroDeNegocio ? error.status : 500).json({ erro: error instanceof ErroDeNegocio ? error.message : 'Erro ao buscar dados da barbearia' });
    }
  }

  /** PUT /configuracoes/minha-barbearia */
  static async updateMinhaBarbearia(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = unidadeDoAdministrador(req);


      const dados = objetoPermitido(req.body, ['nome', 'slug', 'corPrimaria', 'corSecundaria', 'corTexto', 'fonte', 'logo', 'endereco', 'telefone', 'horarioAbertura', 'horarioFechamento', 'temAlmoco', 'horarioAlmocoInicio', 'horarioAlmocoFim']);
      const data: Prisma.BarbeariaUpdateInput = {};
      if (dados.nome !== undefined) data.nome = texto(dados.nome, 200);
      if (dados.slug !== undefined) data.slug = texto(dados.slug, 200, true);
      for (const campo of ['corPrimaria', 'corSecundaria', 'corTexto', 'fonte', 'endereco', 'telefone'] as const) {
        if (dados[campo] !== undefined) data[campo] = dados[campo] === null ? null : texto(dados[campo], campo === 'endereco' ? 1000 : 200, true);
      }
      for (const campo of ['horarioAbertura', 'horarioFechamento', 'horarioAlmocoInicio', 'horarioAlmocoFim'] as const) {
        if (dados[campo] === undefined) continue;
        if (dados[campo] === null || dados[campo] === '') { data[campo] = dados[campo]; continue; }
        const hora = texto(dados[campo], 5);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new ErroDeNegocio('Informe um horário válido.');
        data[campo] = hora;
      }
      if (dados.temAlmoco !== undefined) data.temAlmoco = booleano(dados.temAlmoco);
      const logo = dados.logo;
      const atual = await prisma.barbearia.findUnique({ where: { id: barbeariaId }, select: { logo: true } });
      if (!atual) throw new ErroDeNegocio('Barbearia não encontrada.', 404);
      validarReferenciaImagemRecebida(logo, atual.logo);
      const limparLogo = logo === '' || logo === null;
      if (limparLogo) data.logo = null;
      if (typeof data.nome === 'string' && (!data.slug || (typeof data.slug === 'string' && !data.slug.trim()))) {
        data.slug = gerarSlug(data.nome);
      }
      if (data.slug !== undefined && (typeof data.slug !== 'string' || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(data.slug))) {
        throw new ErroDeNegocio('Escolha um endereço válido para a barbearia.');
      }

      const barbearia = await prisma.barbearia.update({
        where: { id: barbeariaId },
        data
      });

      if (barbeariaId) delete cacheBarbearia[barbeariaId];

      res.json(barbearia);
    } catch (error) {
      res.status(error instanceof ErroDeNegocio ? error.status : 400).json({ erro: error instanceof ErroDeNegocio ? error.message : 'Erro ao atualizar barbearia. Slug pode já estar em uso.' });
    }
  }
}
