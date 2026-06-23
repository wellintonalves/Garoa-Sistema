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
import fidelidadeRoutes from './fidelidade.routes';
import publicoRoutes from './publico.routes';
import tenantRoutes from './tenantRoutes';
import clienteAppRoutes from './clienteApp.routes';
import barbeiroAppRoutes from './barbeiroApp.routes';
import uploadRoutes from './upload.routes';
import verificacaoRoutes from './verificacao.routes';
import recuperacaoRoutes from './recuperacao.routes';

const router = Router();

// Rotas públicas e multi-tenant
router.use('/publico', publicoRoutes);
router.use('/b', tenantRoutes);

// Apps isolados — cliente e barbeiro
router.use('/cliente', clienteAppRoutes);
router.use('/barbeiro', barbeiroAppRoutes);

// Rotas protegidas (admin)
router.use('/auth', authRoutes);
router.use('/barbeiros', barbeiroRoutes);
router.use('/clientes', clienteRoutes);
router.use('/servicos', servicoRoutes);
router.use('/agendamentos', agendamentoRoutes);
router.use('/financeiro', financeiroRoutes);
router.use('/estoque', estoqueRoutes);
router.use('/relatorios', relatorioRoutes);
router.use('/configuracoes', configuracaoRoutes);
router.use('/fidelidade', fidelidadeRoutes);
router.use('/upload', uploadRoutes);
router.use('/verificacao', verificacaoRoutes);
router.use('/recuperacao', recuperacaoRoutes);

export default router;
