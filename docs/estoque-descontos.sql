-- Somente postgres-dev aplicado nesta tarefa. Revisar antes de futura publicação.
-- Executar APÓS estoque-venda-composta.sql em um banco ainda sem essas estruturas.
BEGIN;
ALTER TABLE "vendas_estoque"
ADD COLUMN "descontoManual" DECIMAL(10,2),
ADD COLUMN "descontoPercentual" DECIMAL(10,2),
ADD COLUMN "descontoPontos" DECIMAL(10,2),
ADD COLUMN "pontosUtilizados" INTEGER,
ADD COLUMN "tipoDesconto" "TipoDesconto",
ADD COLUMN "valorBruto" DECIMAL(10,2),
ADD COLUMN "valorDesconto" DECIMAL(10,2);
ALTER TABLE "vendas_produtos" ADD COLUMN "descontoRateado" DECIMAL(10,2);
COMMIT;
