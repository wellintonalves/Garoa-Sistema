-- Revisão manual da estrutura inicial de cancelamento de assinatura.
-- Não executar diretamente em produção. O projeto atualmente aplica o schema
-- com `prisma db push` no boot; valide primeiro em ambiente de desenvolvimento.
-- ATENÇÃO: este arquivo é apenas o recorte de cancelamento. Consulte também
-- plano-migracao-assinatura-privacidade.md e gere o diff do schema Prisma completo.

CREATE TYPE "StatusCancelamentoAssinatura" AS ENUM (
  'PROCESSAMENTO_PENDENTE',
  'RENOVACAO_CANCELADA',
  'REJEITADA'
);

CREATE TYPE "CanalCancelamentoAssinatura" AS ENUM ('SISTEMA', 'EMAIL');

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

CREATE UNIQUE INDEX "solicitacoes_cancelamento_assinatura_chaveIdempotencia_key"
  ON "solicitacoes_cancelamento_assinatura"("chaveIdempotencia");

CREATE UNIQUE INDEX "solicitacoes_cancelamento_assinatura_barbeariaId_aberta_key"
  ON "solicitacoes_cancelamento_assinatura"("barbeariaId", "aberta");

CREATE INDEX "solicitacoes_cancelamento_assinatura_barbeariaId_status_idx"
  ON "solicitacoes_cancelamento_assinatura"("barbeariaId", "status");

ALTER TABLE "solicitacoes_cancelamento_assinatura"
  ADD CONSTRAINT "solicitacoes_cancelamento_assinatura_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- A FK opcional para assinaturas_saas deve ser criada depois dessa tabela:
-- ALTER TABLE "solicitacoes_cancelamento_assinatura"
--   ADD CONSTRAINT "solicitacoes_cancelamento_assinatura_assinaturaId_fkey"
--   FOREIGN KEY ("assinaturaId") REFERENCES "assinaturas_saas"("id")
--   ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_cancelamento_assinatura"
  ADD CONSTRAINT "solicitacoes_cancelamento_assinatura_solicitadoPorId_fkey"
  FOREIGN KEY ("solicitadoPorId") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
