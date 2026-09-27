-- Registro do SQL aplicado em 26/09/2026 na réplica Supabase, com autorização específica.
-- Snapshot anterior restaurado e conferido antes da aplicação. Não reexecutar.
-- Não executar no Railway. Ler primeiro backup-supabase-2026-09-26.md.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- CreateEnum
CREATE TYPE "public"."BaseCalculoComissao" AS ENUM ('VALOR_BRUTO', 'VALOR_LIQUIDO');

-- CreateEnum
CREATE TYPE "public"."BaseCalculoPontos" AS ENUM ('VALOR_BRUTO', 'VALOR_LIQUIDO');

-- CreateEnum
CREATE TYPE "public"."CanalCancelamentoAssinatura" AS ENUM ('SISTEMA', 'EMAIL');

-- CreateEnum
CREATE TYPE "public"."OrigemPreferenciaPromocional" AS ENUM ('VALEN', 'BARBEARIA');

-- CreateEnum
CREATE TYPE "public"."PeriodicidadeAssinatura" AS ENUM ('MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "public"."PlanoAssinatura" AS ENUM ('BASICO', 'PRO');

-- CreateEnum
CREATE TYPE "public"."StatusAssinatura" AS ENUM ('PRE_CADASTRO', 'TESTE', 'ATIVA', 'PAGAMENTO_PENDENTE', 'CONSULTA_EXPORTACAO', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "public"."StatusCancelamentoAssinatura" AS ENUM ('PROCESSAMENTO_PENDENTE', 'RENOVACAO_CANCELADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "public"."StatusEventoWebhookAsaas" AS ENUM ('PENDENTE', 'PROCESSANDO', 'PROCESSADO', 'IGNORADO', 'FALHA');

-- CreateEnum
CREATE TYPE "public"."StatusExclusaoDados" AS ENUM ('AGUARDANDO_POLITICA', 'RETENCAO_LEGAL', 'EXCLUSAO_AUTORIZADA', 'PROPAGADA_BACKUP');

-- CreateEnum
CREATE TYPE "public"."StatusMudancaAssinatura" AS ENUM ('SOLICITADA', 'AGUARDANDO_PAGAMENTO', 'AGENDADA', 'EFETIVADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "public"."StatusResgate" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "public"."TipoDesconto" AS ENUM ('NENHUM', 'REAIS', 'PERCENTUAL', 'PONTOS', 'COMBINADO');

-- CreateEnum
CREATE TYPE "public"."TipoMudancaAssinatura" AS ENUM ('UPGRADE', 'DOWNGRADE', 'PERIODICIDADE');

-- CreateEnum
CREATE TYPE "public"."TipoTransacaoPontos" AS ENUM ('ACUMULO', 'RESGATE', 'AJUSTE_MANUAL', 'ESTORNO');

-- AlterTable
ALTER TABLE "public"."agendamentos" ADD COLUMN     "descontoManual" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "descontoPercentualAplic" DECIMAL(10,2),
ADD COLUMN     "descontoPontos" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pontosUtilizados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tipoDesconto" "public"."TipoDesconto" NOT NULL DEFAULT 'NENHUM',
ADD COLUMN     "valorBruto" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "valorDesconto" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "valorLiquido" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."barbearias" ADD COLUMN     "avisoMigracaoEm" TIMESTAMP(3),
ADD COLUMN     "consultaMigracaoAte" TIMESTAMP(3),
ADD COLUMN     "legadoAssinatura" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prazoMigracaoAte" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."barbeiros" ADD COLUMN     "avaliacaoMedia" DOUBLE PRECISION DEFAULT 5.0,
ADD COLUMN     "horariosTrabalho" JSONB,
ADD COLUMN     "telefone" TEXT;

-- AlterTable
ALTER TABLE "public"."clientes_barbearias" ADD COLUMN     "arquivadoEm" TIMESTAMP(3),
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."configuracoes" ADD COLUMN     "baseCalculoComissao" "public"."BaseCalculoComissao" NOT NULL DEFAULT 'VALOR_LIQUIDO',
ADD COLUMN     "baseCalculoPontos" "public"."BaseCalculoPontos" NOT NULL DEFAULT 'VALOR_LIQUIDO';

-- AlterTable
ALTER TABLE "public"."configuracoes_fidelidade" ADD COLUMN     "descontoMaxPercentual" DECIMAL(10,2) NOT NULL DEFAULT 100,
ADD COLUMN     "descontoMaxReais" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "percentualMaxPontos" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "permitirCombinarDescontos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pontosParaIndicado" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resgatePontosAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valorPorPonto" DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "public"."estoque" ADD COLUMN     "categoria" TEXT;

-- AlterTable
ALTER TABLE "public"."lancamentos_financeiros" ADD COLUMN     "baseComissaoAplicada" "public"."BaseCalculoComissao",
ADD COLUMN     "clienteId" TEXT,
ADD COLUMN     "percentualComissao" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "public"."pontos_fidelidade" ADD COLUMN     "agendamentoId" TEXT,
ADD COLUMN     "lancamentoId" TEXT,
ADD COLUMN     "saldoApos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tipo" "public"."TipoTransacaoPontos" NOT NULL DEFAULT 'ACUMULO';

-- AlterTable
ALTER TABLE "public"."resgates_recompensa" ADD COLUMN     "confirmadoEm" TIMESTAMP(3),
ADD COLUMN     "confirmadoPor" TEXT,
ADD COLUMN     "status" "public"."StatusResgate" NOT NULL DEFAULT 'PENDENTE';

-- AlterTable
ALTER TABLE "public"."usuarios" ADD COLUMN     "aceiteDocumentosEm" TIMESTAMP(3),
ADD COLUMN     "aceiteDocumentosOrigem" TEXT,
ADD COLUMN     "privacidadeVersao" TEXT,
ADD COLUMN     "termosUsoVersao" TEXT;

-- AlterTable
ALTER TABLE "public"."vendas_produtos" ADD COLUMN     "descontoRateado" DECIMAL(10,2),
ADD COLUMN     "vendaId" TEXT;

-- CreateTable
CREATE TABLE "public"."assinaturas_saas" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "plano" "public"."PlanoAssinatura" NOT NULL,
    "periodicidade" "public"."PeriodicidadeAssinatura" NOT NULL,
    "status" "public"."StatusAssinatura" NOT NULL DEFAULT 'PRE_CADASTRO',
    "precoCicloCentavos" INTEGER NOT NULL,
    "cicloInicio" TIMESTAMP(3),
    "cicloFim" TIMESTAMP(3),
    "testeInicio" TIMESTAMP(3),
    "testeFim" TIMESTAMP(3),
    "proximaCobrancaEm" TIMESTAMP(3),
    "renovacaoAutomatica" BOOLEAN NOT NULL DEFAULT true,
    "provedor" TEXT NOT NULL DEFAULT 'ASAAS',
    "clienteExternoId" TEXT,
    "assinaturaExternaId" TEXT,
    "checkoutExternoId" TEXT,
    "checkoutUrl" TEXT,
    "checkoutExpiraEm" TIMESTAMP(3),
    "formasPagamento" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contratacaoIdempotencia" TEXT,
    "ultimoEventoProvedorEm" TIMESTAMP(3),
    "ultimaCobrancaExternaId" TEXT,
    "ofertaVersao" TEXT,
    "termosVersao" TEXT,
    "aceiteEm" TIMESTAMP(3),
    "aceitePorId" TEXT,
    "avisoLimiteClientesEm" TIMESTAMP(3),
    "avisoPagamentoEm" TIMESTAMP(3),
    "toleranciaAte" TIMESTAMP(3),
    "fimAcessoEm" TIMESTAMP(3),
    "consultaExportacaoAte" TIMESTAMP(3),
    "reajusteAvisadoEm" TIMESTAMP(3),
    "reajusteEfetivoEm" TIMESTAMP(3),
    "reajustePrecoCentavos" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_saas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."avaliacoes" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "barbeiroId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."boas_vindas_concedidas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boas_vindas_concedidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."eventos_webhook_asaas" (
    "id" TEXT NOT NULL,
    "eventoExternoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recursoTipo" TEXT,
    "recursoExternoId" TEXT,
    "referenciaExterna" TEXT,
    "resumo" JSONB NOT NULL,
    "status" "public"."StatusEventoWebhookAsaas" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ocorridoEm" TIMESTAMP(3),
    "processadoEm" TIMESTAMP(3),
    "ultimoErro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_webhook_asaas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exclusoes_dados_auditaveis" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "status" "public"."StatusExclusaoDados" NOT NULL DEFAULT 'AGUARDANDO_POLITICA',
    "solicitadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluidoPrincipalEm" TIMESTAMP(3),
    "removerBackupAte" TIMESTAMP(3),
    "retencaoLegal" BOOLEAN NOT NULL DEFAULT false,
    "motivoRetencao" TEXT,
    "propagadoBackupEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exclusoes_dados_auditaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."historico_remarcacoes" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "dataHoraAnterior" TIMESTAMP(3) NOT NULL,
    "dataHoraNova" TIMESTAMP(3) NOT NULL,
    "barbeiroAnteriorId" TEXT,
    "barbeiroNovoId" TEXT,
    "servicoAnteriorId" TEXT,
    "servicoNovoId" TEXT,
    "usuarioAcaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_remarcacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."itens_atendimento" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "agendamentoId" TEXT,
    "lancamentoId" TEXT,
    "servicoId" TEXT,
    "nome" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "duracaoMinutos" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itens_atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mudancas_assinatura" (
    "id" TEXT NOT NULL,
    "assinaturaId" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "tipo" "public"."TipoMudancaAssinatura" NOT NULL,
    "status" "public"."StatusMudancaAssinatura" NOT NULL DEFAULT 'SOLICITADA',
    "planoOrigem" "public"."PlanoAssinatura" NOT NULL,
    "planoDestino" "public"."PlanoAssinatura" NOT NULL,
    "periodicidadeOrigem" "public"."PeriodicidadeAssinatura" NOT NULL,
    "periodicidadeDestino" "public"."PeriodicidadeAssinatura" NOT NULL,
    "valorAdicionalCentavos" INTEGER NOT NULL DEFAULT 0,
    "efetivarEm" TIMESTAMP(3),
    "chaveIdempotencia" TEXT NOT NULL,
    "checkoutExternoId" TEXT,
    "checkoutUrl" TEXT,
    "checkoutExpiraEm" TIMESTAMP(3),
    "ofertaVersao" TEXT NOT NULL,
    "aceiteEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mudancas_assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."preferencias_promocionais" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "origem" "public"."OrigemPreferenciaPromocional" NOT NULL,
    "chaveOrigem" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "emailHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "emailAlteradoEm" TIMESTAMP(3),
    "inAppHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "inAppAlteradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferencias_promocionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."solicitacoes_cancelamento_assinatura" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "solicitadoPorEmail" TEXT NOT NULL,
    "canal" "public"."CanalCancelamentoAssinatura" NOT NULL DEFAULT 'SISTEMA',
    "status" "public"."StatusCancelamentoAssinatura" NOT NULL DEFAULT 'PROCESSAMENTO_PENDENTE',
    "chaveIdempotencia" TEXT NOT NULL,
    "aberta" BOOLEAN DEFAULT true,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'ASAAS',
    "assinaturaExternaId" TEXT,
    "assinaturaId" TEXT,
    "tentativasProvedor" INTEGER NOT NULL DEFAULT 0,
    "ultimaTentativaEm" TIMESTAMP(3),
    "ultimoErroProvedor" TEXT,
    "cancelamentoConfirmadoEm" TIMESTAMP(3),
    "fimAcessoEm" TIMESTAMP(3),
    "motivo" TEXT,

    CONSTRAINT "solicitacoes_cancelamento_assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendas_estoque" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "chaveRequisicao" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "formaPagamento" "public"."FormaPagamento" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lancamentoId" TEXT NOT NULL,
    "descontoManual" DECIMAL(10,2),
    "descontoPercentual" DECIMAL(10,2),
    "descontoPontos" DECIMAL(10,2),
    "pontosUtilizados" INTEGER,
    "tipoDesconto" "public"."TipoDesconto",
    "valorBruto" DECIMAL(10,2),
    "valorDesconto" DECIMAL(10,2),
    "estornadaEm" TIMESTAMP(3),
    "estornadoPorId" TEXT,
    "estornoLancamentoId" TEXT,
    "motivoEstorno" TEXT,

    CONSTRAINT "vendas_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_saas_assinaturaExternaId_key" ON "public"."assinaturas_saas"("assinaturaExternaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_saas_barbeariaId_key" ON "public"."assinaturas_saas"("barbeariaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_saas_checkoutExternoId_key" ON "public"."assinaturas_saas"("checkoutExternoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_saas_contratacaoIdempotencia_key" ON "public"."assinaturas_saas"("contratacaoIdempotencia" ASC);

-- CreateIndex
CREATE INDEX "assinaturas_saas_status_proximaCobrancaEm_idx" ON "public"."assinaturas_saas"("status" ASC, "proximaCobrancaEm" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_agendamentoId_key" ON "public"."avaliacoes"("agendamentoId" ASC);

-- CreateIndex
CREATE INDEX "avaliacoes_barbeiroId_idx" ON "public"."avaliacoes"("barbeiroId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "boas_vindas_concedidas_clienteId_barbeariaId_key" ON "public"."boas_vindas_concedidas"("clienteId" ASC, "barbeariaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "eventos_webhook_asaas_eventoExternoId_key" ON "public"."eventos_webhook_asaas"("eventoExternoId" ASC);

-- CreateIndex
CREATE INDEX "eventos_webhook_asaas_recursoExternoId_idx" ON "public"."eventos_webhook_asaas"("recursoExternoId" ASC);

-- CreateIndex
CREATE INDEX "eventos_webhook_asaas_referenciaExterna_idx" ON "public"."eventos_webhook_asaas"("referenciaExterna" ASC);

-- CreateIndex
CREATE INDEX "eventos_webhook_asaas_status_recebidoEm_idx" ON "public"."eventos_webhook_asaas"("status" ASC, "recebidoEm" ASC);

-- CreateIndex
CREATE INDEX "exclusoes_dados_auditaveis_barbeariaId_idx" ON "public"."exclusoes_dados_auditaveis"("barbeariaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "exclusoes_dados_auditaveis_entidade_registroId_key" ON "public"."exclusoes_dados_auditaveis"("entidade" ASC, "registroId" ASC);

-- CreateIndex
CREATE INDEX "exclusoes_dados_auditaveis_status_removerBackupAte_idx" ON "public"."exclusoes_dados_auditaveis"("status" ASC, "removerBackupAte" ASC);

-- CreateIndex
CREATE INDEX "historico_remarcacoes_agendamentoId_idx" ON "public"."historico_remarcacoes"("agendamentoId" ASC);

-- CreateIndex
CREATE INDEX "itens_atendimento_agendamentoId_idx" ON "public"."itens_atendimento"("agendamentoId" ASC);

-- CreateIndex
CREATE INDEX "itens_atendimento_barbeariaId_idx" ON "public"."itens_atendimento"("barbeariaId" ASC);

-- CreateIndex
CREATE INDEX "itens_atendimento_lancamentoId_idx" ON "public"."itens_atendimento"("lancamentoId" ASC);

-- CreateIndex
CREATE INDEX "itens_atendimento_servicoId_idx" ON "public"."itens_atendimento"("servicoId" ASC);

-- CreateIndex
CREATE INDEX "mudancas_assinatura_assinaturaId_status_idx" ON "public"."mudancas_assinatura"("assinaturaId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "mudancas_assinatura_chaveIdempotencia_key" ON "public"."mudancas_assinatura"("chaveIdempotencia" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "mudancas_assinatura_checkoutExternoId_key" ON "public"."mudancas_assinatura"("checkoutExternoId" ASC);

-- CreateIndex
CREATE INDEX "preferencias_promocionais_barbeariaId_idx" ON "public"."preferencias_promocionais"("barbeariaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_promocionais_clienteId_chaveOrigem_key" ON "public"."preferencias_promocionais"("clienteId" ASC, "chaveOrigem" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_cancelamento_assinatura_barbeariaId_aberta_key" ON "public"."solicitacoes_cancelamento_assinatura"("barbeariaId" ASC, "aberta" ASC);

-- CreateIndex
CREATE INDEX "solicitacoes_cancelamento_assinatura_barbeariaId_status_idx" ON "public"."solicitacoes_cancelamento_assinatura"("barbeariaId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_cancelamento_assinatura_chaveIdempotencia_key" ON "public"."solicitacoes_cancelamento_assinatura"("chaveIdempotencia" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "vendas_estoque_barbeariaId_chaveRequisicao_key" ON "public"."vendas_estoque"("barbeariaId" ASC, "chaveRequisicao" ASC);

-- CreateIndex
CREATE INDEX "vendas_estoque_barbeariaId_data_idx" ON "public"."vendas_estoque"("barbeariaId" ASC, "data" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "vendas_estoque_estornoLancamentoId_key" ON "public"."vendas_estoque"("estornoLancamentoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "vendas_estoque_lancamentoId_key" ON "public"."vendas_estoque"("lancamentoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pontos_fidelidade_agendamentoId_key" ON "public"."pontos_fidelidade"("agendamentoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pontos_fidelidade_lancamentoId_key" ON "public"."pontos_fidelidade"("lancamentoId" ASC);

-- CreateIndex
CREATE INDEX "vendas_produtos_vendaId_idx" ON "public"."vendas_produtos"("vendaId" ASC);

-- AddForeignKey
ALTER TABLE "public"."assinaturas_saas" ADD CONSTRAINT "assinaturas_saas_aceitePorId_fkey" FOREIGN KEY ("aceitePorId") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assinaturas_saas" ADD CONSTRAINT "assinaturas_saas_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "public"."barbearias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."avaliacoes" ADD CONSTRAINT "avaliacoes_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "public"."agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."avaliacoes" ADD CONSTRAINT "avaliacoes_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "public"."barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."avaliacoes" ADD CONSTRAINT "avaliacoes_barbeiroId_fkey" FOREIGN KEY ("barbeiroId") REFERENCES "public"."barbeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."avaliacoes" ADD CONSTRAINT "avaliacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "public"."agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "public"."barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_barbeiroAnteriorId_fkey" FOREIGN KEY ("barbeiroAnteriorId") REFERENCES "public"."barbeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_barbeiroNovoId_fkey" FOREIGN KEY ("barbeiroNovoId") REFERENCES "public"."barbeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_servicoAnteriorId_fkey" FOREIGN KEY ("servicoAnteriorId") REFERENCES "public"."servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_servicoNovoId_fkey" FOREIGN KEY ("servicoNovoId") REFERENCES "public"."servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_usuarioAcaoId_fkey" FOREIGN KEY ("usuarioAcaoId") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."itens_atendimento" ADD CONSTRAINT "itens_atendimento_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "public"."agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."itens_atendimento" ADD CONSTRAINT "itens_atendimento_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "public"."barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."itens_atendimento" ADD CONSTRAINT "itens_atendimento_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "public"."lancamentos_financeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."itens_atendimento" ADD CONSTRAINT "itens_atendimento_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "public"."servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mudancas_assinatura" ADD CONSTRAINT "mudancas_assinatura_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "public"."assinaturas_saas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mudancas_assinatura" ADD CONSTRAINT "mudancas_assinatura_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pontos_fidelidade" ADD CONSTRAINT "pontos_fidelidade_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "public"."lancamentos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."preferencias_promocionais" ADD CONSTRAINT "preferencias_promocionais_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "public"."barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."preferencias_promocionais" ADD CONSTRAINT "preferencias_promocionais_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."solicitacoes_cancelamento_assinatura" ADD CONSTRAINT "solicitacoes_cancelamento_assinatura_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "public"."assinaturas_saas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."solicitacoes_cancelamento_assinatura" ADD CONSTRAINT "solicitacoes_cancelamento_assinatura_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "public"."barbearias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."solicitacoes_cancelamento_assinatura" ADD CONSTRAINT "solicitacoes_cancelamento_assinatura_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendas_estoque" ADD CONSTRAINT "vendas_estoque_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "public"."barbearias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendas_estoque" ADD CONSTRAINT "vendas_estoque_estornoLancamentoId_fkey" FOREIGN KEY ("estornoLancamentoId") REFERENCES "public"."lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendas_estoque" ADD CONSTRAINT "vendas_estoque_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "public"."lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendas_produtos" ADD CONSTRAINT "vendas_produtos_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "public"."vendas_estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;

