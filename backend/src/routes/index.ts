// Agregador de todas as rotas
import { Router } from 'express';
import authRoutes from './auth.routes';
import barbeiroRoutes from './barbeiro.routes';
import clienteRoutes from './cliente.routes';
import servicoRoutes from './servico.routes';
import agendamentoRoutes from './agendamento.routes';
import financeiroRoutes from './financeiro.routes';
import estoqueRoutes from './estoque.routes';
import relatorioRoutes from './relatorio.routes';
import configuracaoRoutes from './configuracao.routes';
import publicoRoutes from './publico.routes';

const router = Router();

// Rotas públicas (sem autenticação)
router.use('/publico', publicoRoutes);

// Rotas protegidas
router.use('/auth', authRoutes);
router.use('/barbeiros', barbeiroRoutes);
router.use('/clientes', clienteRoutes);
router.use('/servicos', servicoRoutes);
router.use('/agendamentos', agendamentoRoutes);
router.use('/financeiro', financeiroRoutes);
router.use('/estoque', estoqueRoutes);
router.use('/relatorios', relatorioRoutes);
router.use('/configuracoes', configuracaoRoutes);

export default router;
