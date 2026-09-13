-- Somente aditivo; gerado após diff vazio de baseline. Aplicado apenas no postgres-dev.
BEGIN;
ALTER TABLE "vendas_estoque" ADD COLUMN "estornadaEm" TIMESTAMP(3),
ADD COLUMN "estornadoPorId" TEXT, ADD COLUMN "estornoLancamentoId" TEXT,
ADD COLUMN "motivoEstorno" TEXT;
CREATE UNIQUE INDEX "vendas_estoque_estornoLancamentoId_key" ON "vendas_estoque"("estornoLancamentoId");
ALTER TABLE "vendas_estoque" ADD CONSTRAINT "vendas_estoque_estornoLancamentoId_fkey"
FOREIGN KEY ("estornoLancamentoId") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
