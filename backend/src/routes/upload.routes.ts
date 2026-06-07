import { Router } from 'express';
import multer from 'multer';
import { SupabaseService } from '../services/supabase.service';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limite

router.use(authMiddleware);

router.post('/logo', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ erro: 'Nenhum arquivo enviado' });
      return;
    }
    const barbeariaId = req.usuario?.barbeariaId;
    if (!barbeariaId) {
      res.status(401).json({ erro: 'Não autorizado' });
      return;
    }

    const extension = req.file.originalname.split('.').pop();
    const fileName = `logo-${barbeariaId}-${Date.now()}.${extension}`;
    
    const url = await SupabaseService.uploadImage('barbearias', fileName, req.file.buffer, req.file.mimetype);
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ erro: error.message });
  }
});

router.post('/barbeiro', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ erro: 'Nenhum arquivo enviado' });
      return;
    }
    
    const extension = req.file.originalname.split('.').pop();
    const fileName = `foto-${Date.now()}.${extension}`;
    
    const url = await SupabaseService.uploadImage('barbeiros', fileName, req.file.buffer, req.file.mimetype);
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ erro: error.message });
  }
});

export default router;
