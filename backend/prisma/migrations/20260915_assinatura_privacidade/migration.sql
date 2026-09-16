-- Gerado por `prisma migrate diff` entre o schema versionado anterior e o schema atual.
-- Aplicar primeiro em PostgreSQL descartável e depois em desenvolvimento aprovado.
-- Não executar diretamente em produção.
BEGIN;

-- CreateEnum
CREATE TYPE "StatusCancelamentoAssinatura" AS ENUM ('PROCESSAMENTO_PENDENTE', 'RENOVACAO_CANCELADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "CanalCancelamentoAssinatura" AS ENUM ('SISTEMA', 'EMAIL');

-- CreateEnum
CREATE TYPE "PlanoAssinatura" AS ENUM ('BASICO', 'PRO');

-- CreateEnum
CREATE TYPE "PeriodicidadeAssinatura" AS ENUM ('MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('PRE_CADASTRO', 'TESTE', 'ATIVA', 'PAGAMENTO_PENDENTE', 'CONSULTA_EXPORTACAO', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "TipoMudancaAssinatura" AS ENUM ('UPGRADE', 'DOWNGRADE', 'PERIODICIDADE');

-- CreateEnum
CREATE TYPE "StatusMudancaAssinatura" AS ENUM ('SOLICITADA', 'AGUARDANDO_PAGAMENTO', 'AGENDADA', 'EFETIVADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "OrigemPreferenciaPromocional" AS ENUM ('VALEN', 'BARBEARIA');

-- CreateEnum
CREATE TYPE "StatusExclusaoDados" AS ENUM ('AGUARDANDO_POLITICA', 'RETENCAO_LEGAL', 'EXCLUSAO_AUTORIZADA', 'PROPAGADA_BACKUP');

-- CreateEnum
CREATE TYPE "StatusEventoWebhookAsaas" AS ENUM ('PENDENTE', 'PROCESSANDO', 'PROCESSADO', 'IGNORADO', 'FALHA');

-- AlterTable
ALTER TABLE "clientes_barbearias" ADD COLUMN     "arquivadoEm" TIMESTAMP(3),
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "preferencias_promocionais" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "origem" "OrigemPreferenciaPromocional" NOT NULL,
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
CREATE TABLE "exclusoes_dados_auditaveis" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "status" "StatusExclusaoDados" NOT NULL DEFAULT 'AGUARDANDO_POLITICA',
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
CREATE TABLE "assinaturas_saas" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "plano" "PlanoAssinatura" NOT NULL,
    "periodicidade" "PeriodicidadeAssinatura" NOT NULL,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'PRE_CADASTRO',
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
CREATE TABLE "mudancas_assinatura" (
    "id" TEXT NOT NULL,
    "assinaturaId" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "tipo" "TipoMudancaAssinatura" NOT NULL,
    "status" "StatusMudancaAssinatura" NOT NULL DEFAULT 'SOLICITADA',
    "planoOrigem" "PlanoAssinatura" NOT NULL,
    "planoDestino" "PlanoAssinatura" NOT NULL,
    "periodicidadeOrigem" "PeriodicidadeAssinatura" NOT NULL,
    "periodicidadeDestino" "PeriodicidadeAssinatura" NOT NULL,
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
CREATE TABLE "eventos_webhook_asaas" (
    "id" TEXT NOT NULL,
    "eventoExternoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recursoTipo" TEXT,
    "recursoExternoId" TEXT,
    "referenciaExterna" TEXT,
    "resumo" JSONB NOT NULL,
    "status" "StatusEventoWebhookAsaas" NOT NULL DEFAULT 'PENDENTE',
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
CREATE TABLE "solicitacoes_cancelamento_assinatura" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "solicitadoPorEmail" TEXT NOT NULL,
    "canal" "CanalCancelamentoAssinatura" NOT NULL DEFAULT 'SISTEMA',
    "status" "StatusCancelamentoAssinatura" NOT NULL DEFAULT 'PROCESSAMENTO_PENDENTE',
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

-- CreateIndex
CREATE INDEX "preferencias_promocionais_barbeariaId_idx" ON "preferencias_promocionais"("barbeariaId");

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_promocionais_clienteId_chaveOrigem_key" ON "preferencias_promocionais"("clienteId", "chaveOrigem");

-- CreateIndex
CREATE INDEX "exclusoes_dados_auditaveis_status_removerBackupAte_idx" ON "exclusoes_dados_auditaveis"("status", "removerBackupAte");

-- CreateIndex
CREATE INDEX "exclusoes_dados_auditaveis_barbeariaId_idx" ON "exclusoes_dados_auditaveis"("barbeariaId");

-- CreateIndex
CREATE UNIQUE INDEX "exclusoes_dados_auditaveis_entidade_registroId_key" ON "exclusoes_dados_auditaveis"("entidade", "registroId");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_saas_barbeariaId_key" ON "assinaturas_saas"("barbeariaId");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_saas_assinaturaExternaId_key" ON "assinaturas_saas"("assinaturaExternaId");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_saas_checkoutExternoId_key" ON "assinaturas_saas"("checkoutExternoId");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_saas_contratacaoIdempotencia_key" ON "assinaturas_saas"("contratacaoIdempotencia");

-- CreateIndex
CREATE INDEX "assinaturas_saas_status_proximaCobrancaEm_idx" ON "assinaturas_saas"("status", "proximaCobrancaEm");

-- CreateIndex
CREATE UNIQUE INDEX "mudancas_assinatura_chaveIdempotencia_key" ON "mudancas_assinatura"("chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "mudancas_assinatura_checkoutExternoId_key" ON "mudancas_assinatura"("checkoutExternoId");

-- CreateIndex
CREATE INDEX "mudancas_assinatura_assinaturaId_status_idx" ON "mudancas_assinatura"("assinaturaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_webhook_asaas_eventoExternoId_key" ON "eventos_webhook_asaas"("eventoExternoId");

-- CreateIndex
CREATE INDEX "eventos_webhook_asaas_status_recebidoEm_idx" ON "eventos_webhook_asaas"("status", "recebidoEm");

-- CreateIndex
CREATE INDEX "eventos_webhook_asaas_referenciaExterna_idx" ON "eventos_webhook_asaas"("referenciaExterna");

-- CreateIndex
CREATE INDEX "eventos_webhook_asaas_recursoExternoId_idx" ON "eventos_webhook_asaas"("recursoExternoId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_cancelamento_assinatura_chaveIdempotencia_key" ON "solicitacoes_cancelamento_assinatura"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "solicitacoes_cancelamento_assinatura_barbeariaId_status_idx" ON "solicitacoes_cancelamento_assinatura"("barbeariaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_cancelamento_assinatura_barbeariaId_aberta_key" ON "solicitacoes_cancelamento_assinatura"("barbeariaId", "aberta");

-- AddForeignKey
ALTER TABLE "preferencias_promocionais" ADD CONSTRAINT "preferencias_promocionais_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_promocionais" ADD CONSTRAINT "preferencias_promocionais_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_saas" ADD CONSTRAINT "assinaturas_saas_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_saas" ADD CONSTRAINT "assinaturas_saas_aceitePorId_fkey" FOREIGN KEY ("aceitePorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mudancas_assinatura" ADD CONSTRAINT "mudancas_assinatura_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "assinaturas_saas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mudancas_assinatura" ADD CONSTRAINT "mudancas_assinatura_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_cancelamento_assinatura" ADD CONSTRAINT "solicitacoes_cancelamento_assinatura_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_cancelamento_assinatura" ADD CONSTRAINT "solicitacoes_cancelamento_assinatura_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_cancelamento_assinatura" ADD CONSTRAINT "solicitacoes_cancelamento_assinatura_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "assinaturas_saas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
