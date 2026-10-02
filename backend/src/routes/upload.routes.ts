import { Router } from 'express';
import { invalidarCacheBarbearia } from '../controllers/configuracao.controller';
import { SupabaseService } from '../services/supabase.service';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { uploadImagem } from '../middlewares/upload.middleware';

const router = Router();
router.use(authMiddleware, roleMiddleware('ADMIN'));

for (const [rota, bucket] of [['/logo', 'barbearias'], ['/barbeiro', 'barbeiros']] as const) {
  router.post(rota, ...uploadImagem, async (req, res, next) => {
    try {
      const usuario = req.usuario;
      if (!usuario?.barbeariaId || !req.file) {
        res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente para continuar.' }); return;
      }
      if (bucket === 'barbeiros' && (typeof req.query.barbeiroId !== 'string' || !req.query.barbeiroId)) {
        res.status(400).json({ erro: 'Salve o cadastro do barbeiro antes de enviar a foto.' }); return;
      }
      const url = await SupabaseService.uploadImage(bucket,
        { barbeariaId: usuario.barbeariaId, usuarioId: usuario.id, papel: 'ADMIN' }, req.file.buffer, req.file.mimetype, bucket === 'barbeiros' ? req.query.barbeiroId as string : undefined);
      if (bucket === 'barbearias') invalidarCacheBarbearia(usuario.barbeariaId);
      res.json({ url });
    } catch (error) { next(error); }
  });
}

export default router;
