import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../types';
import { AssinaturaService } from '../services/assinatura.service';
import { TransicaoLegadoService } from '../services/transicaoLegado.service';
import { AvisoPagamentoService } from '../services/avisoPagamento.service';
import archiver from 'archiver';
import { gerarArquivosExportacao } from '../services/exportacaoCsv.service';
import { AssinaturaOperacionalService } from '../services/assinaturaOperacional.service';
import { WebhookAsaasService } from '../services/webhookAsaas.service';
import { validarTokenWebhookAsaas } from '../integrations/assinaturas/provedorAssinatura';
import { RegularizacaoAssinaturaService } from '../services/regularizacaoAssinatura.service';

export class AssinaturaController {
  static async obterRegularizacao(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { res.setHeader('Cache-Control', 'no-store'); res.json(await RegularizacaoAssinaturaService.obter(req.usuario!)); }
    catch (error) { next(error); }
  }
  static async usarCartaoDaCobranca(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { res.json(await RegularizacaoAssinaturaService.usarCartao(req.usuario!, req.body.aceite, req.ip || '')); }
    catch (error) { next(error); }
  }
  static async registrarAvisoPagamento(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { res.json(await AvisoPagamentoService.registrar(req.usuario!)); }
    catch (error) { next(error); }
  }
  static async registrarAvisoLegado(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { res.json({ transicaoLegado: await TransicaoLegadoService.registrarAviso(req.usuario!) }); }
    catch (error) { next(error); }
  }
  static async receberWebhookAsaas(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!validarTokenWebhookAsaas(req.header('asaas-access-token'))) {
        res.status(401).json({ erro: 'Webhook não autorizado.' });
        return;
      }
      if (process.env.ASSINATURA_ASAAS_PRODUCTION_ENABLED === 'true' &&
        (!process.env.ASAAS_ACCOUNT_ID || req.body?.account?.id !== process.env.ASAAS_ACCOUNT_ID)) {
        res.status(401).json({ erro: 'Conta do webhook não autorizada.' });
        return;
      }
      const registrado = await WebhookAsaasService.registrar(req.body);
      res.status(200).json({ received: true, duplicate: registrado.duplicado });
      if (!registrado.duplicado && registrado.eventoId) {
        setImmediate(() => {
          void WebhookAsaasService.processar(registrado.eventoId!).catch((error) => {
            console.error('Falha ao processar evento Asaas persistido:', error instanceof Error ? error.message : 'erro desconhecido');
          });
        });
      }
    } catch (error) {
      next(error);
    }
  }

  static async obterResumo(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      res.json(await AssinaturaOperacionalService.obterResumo(req.usuario!));
    } catch (error) {
      next(error);
    }
  }

  static async iniciarContratacao(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const resultado = await AssinaturaOperacionalService.iniciarContratacao(req.usuario!, {
        ...req.body,
        chaveIdempotencia: String(req.header('Idempotency-Key') || ''),
      });
      res.status(resultado.nova ? 201 : 200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  static async solicitarMudanca(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const resultado = await AssinaturaOperacionalService.solicitarMudanca(req.usuario!, {
        ...req.body,
        chaveIdempotencia: String(req.header('Idempotency-Key') || ''),
      });
      res.status(resultado.nova ? 201 : 200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  static async exportarDados(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const exportacao = await AssinaturaService.exportarDados(req.usuario!);
      const data = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="valen-exportacao-${data}.zip"`);
      const pacote = archiver('zip', { zlib: { level: 9 } });
      pacote.on('error', next);
      pacote.pipe(res);
      for (const arquivo of gerarArquivosExportacao(exportacao)) {
        pacote.append(arquivo.conteudo, { name: arquivo.nome });
      }
      await pacote.finalize();
    } catch (error) {
      next(error);
    }
  }

  static async obterCancelamento(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      res.json(await AssinaturaService.obterCancelamentoAtual(req.usuario!));
    } catch (error) {
      next(error);
    }
  }

  static async solicitarCancelamento(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const chaveIdempotencia = String(req.header('Idempotency-Key') || '');
      const resultado = await AssinaturaService.solicitarCancelamento(req.usuario!, {
        confirmacaoNome: req.body.confirmacaoNome,
        motivo: req.body.motivo,
        chaveIdempotencia,
      });
      res.status(resultado.nova ? 201 : 200).json(resultado);
    } catch (error) {
      next(error);
    }
  }
}
