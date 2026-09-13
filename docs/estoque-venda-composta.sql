-- Aplicado somente em postgres-dev via prisma db push em 13/09/2026.
-- Produção: revisar/aplicar antes de publicar código; não executar automaticamente.
BEGIN;
ALTER TABLE "estoque" ADD COLUMN "categoria" TEXT;
ALTER TABLE "vendas_produtos" ADD COLUMN "vendaId" TEXT;
CREATE TABLE "vendas_estoque" (
  "id" TEXT NOT NULL,
  "barbeariaId" TEXT NOT NULL,
  "chaveRequisicao" TEXT NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "formaPagamento" "FormaPagamento" NOT NULL,
  "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lancamentoId" TEXT NOT NULL,
  CONSTRAINT "vendas_estoque_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendas_estoque_lancamentoId_key" ON "vendas_estoque"("lancamentoId");
CREATE INDEX "vendas_estoque_barbeariaId_data_idx" ON "vendas_estoque"("barbeariaId", "data");
CREATE UNIQUE INDEX "vendas_estoque_barbeariaId_chaveRequisicao_key" ON "vendas_estoque"("barbeariaId", "chaveRequisicao");
CREATE INDEX "vendas_produtos_vendaId_idx" ON "vendas_produtos"("vendaId");
ALTER TABLE "vendas_produtos" ADD CONSTRAINT "vendas_produtos_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas_estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendas_estoque" ADD CONSTRAINT "vendas_estoque_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendas_estoque" ADD CONSTRAINT "vendas_estoque_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
