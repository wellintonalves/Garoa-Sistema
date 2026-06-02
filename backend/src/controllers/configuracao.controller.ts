import { Response } from 'express';
import { ConfiguracaoService } from '../services/configuracao.service';
import { AuthRequest } from '../types';

export class ConfiguracaoController {
  /** GET /configuracoes */
  static async obter(req: AuthRequest, res: Response): Promise<void> {
    try {
      const config = await ConfiguracaoService.obter(req.usuario?.barbeariaId);
      res.json(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao obter configurações';
      res.status(500).json({ erro: msg });
    }
  }

  /** PUT /configuracoes */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const config = await ConfiguracaoService.atualizar(req.body, req.usuario?.barbeariaId);
      res.json(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar configurações';
      res.status(400).json({ erro: msg });
    }
  }

  /** GET /configuracoes/minha-barbearia */
  static async getMinhaBarbearia(req: AuthRequest, res: Response): Promise<void> {
    try {
      let barbeariaId = req.usuario?.barbeariaId;
      const { prisma } = require('../lib/prisma');
      
      if (!barbeariaId && req.usuario?.papel === 'ADMIN') {
        const primeira = await prisma.barbearia.findFirst();
        if (primeira) {
          barbeariaId = primeira.id;
        } else {
          // Cria uma barbearia default se o admin ainda não tiver nenhuma e não existir no banco
          const novaBarbearia = await prisma.barbearia.create({
            data: {
              nome: 'Minha Barbearia',
              slug: `minha-barbearia-${Date.now()}`,
            }
          });
          barbeariaId = novaBarbearia.id;
          
          // Vincula o admin à nova barbearia
          if (req.usuario?.id) {
            await prisma.usuario.update({
              where: { id: req.usuario.id },
              data: { barbeariaId: novaBarbearia.id }
            });
          }
        }
      }

      if (!barbeariaId) { res.status(404).json({ erro: 'Barbearia não encontrada' }); return; }

      const barbearia = await prisma.barbearia.findUnique({ where: { id: barbeariaId } });
      const clientesCount = await prisma.cliente.count({ where: { barbeariaId } });

      res.json({ ...barbearia, clientesCount });
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar dados da barbearia' });
    }
  }

  /** PUT /configuracoes/minha-barbearia */
  static async updateMinhaBarbearia(req: AuthRequest, res: Response): Promise<void> {
    try {
      let barbeariaId = req.usuario?.barbeariaId;
      const { prisma } = require('../lib/prisma');

      if (!barbeariaId && req.usuario?.papel === 'ADMIN') {
        const primeira = await prisma.barbearia.findFirst();
        if (primeira) {
          barbeariaId = primeira.id;
        } else {
          // Cria uma barbearia default se o admin ainda não tiver nenhuma e não existir no banco
          const novaBarbearia = await prisma.barbearia.create({
            data: {
              nome: req.body.nome || 'Minha Barbearia',
              slug: `minha-barbearia-${Date.now()}`,
            }
          });
          barbeariaId = novaBarbearia.id;
          
          // Vincula o admin à nova barbearia
          if (req.usuario?.id) {
            await prisma.usuario.update({
              where: { id: req.usuario.id },
              data: { barbeariaId: novaBarbearia.id }
            });
          }
        }
      }

      if (!barbeariaId) { res.status(404).json({ erro: 'Barbearia não encontrada' }); return; }

      const { nome, corPrimaria, endereco, telefone } = req.body;
      let slug = req.body.slug;
      
      // Se não enviou slug mas enviou nome, gera o slug a partir do nome
      if (nome && (!slug || slug.trim() === '')) {
        slug = nome.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
      }

      const barbearia = await prisma.barbearia.update({
        where: { id: barbeariaId },
        data: { nome, slug, corPrimaria, endereco, telefone }
      });

      res.json(barbearia);
    } catch (error) {
      res.status(400).json({ erro: 'Erro ao atualizar barbearia. Slug pode já estar em uso.' });
    }
  }
}
