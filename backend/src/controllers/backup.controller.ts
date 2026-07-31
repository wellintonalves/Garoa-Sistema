import { Request, Response } from 'express';
import { copiarBanco } from '../lib/dbSync';

export class BackupController {
  static async forcarBackup(req: Request, res: Response) {
    try {
      const sourceUrl = process.env.DATABASE_URL;
      const targetUrl = process.env.BACKUP_DIRECT_URL;

      if (!sourceUrl || !targetUrl) {
        return res.status(500).json({
          error: 'Configurações de banco de dados ausentes (DATABASE_URL ou BACKUP_DIRECT_URL).'
        });
      }

      console.log('🚀 Backup manual iniciado via API (Admin)');
      const result = await copiarBanco(sourceUrl, targetUrl);
      
      return res.status(200).json({
        message: 'Backup concluído com sucesso',
        ...result
      });
    } catch (error) {
      console.error('❌ Falha no backup forçado via API:', error);
      return res.status(500).json({
        error: 'Falha ao forçar o backup',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
