-- Aplicação única, após aprovação de implantação. Não executado em produção.
-- Impacto: somente política de acesso; não altera agenda, financeiro, comissões,
-- fidelidade, relatórios, clientes ou seus históricos. Nenhuma cobrança criada.
BEGIN;
ALTER TABLE "barbearias" ADD COLUMN "legadoAssinatura" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "barbearias" ADD COLUMN "avisoMigracaoEm" TIMESTAMP(3);
ALTER TABLE "barbearias" ADD COLUMN "prazoMigracaoAte" TIMESTAMP(3);
ALTER TABLE "barbearias" ADD COLUMN "consultaMigracaoAte" TIMESTAMP(3);
UPDATE "barbearias" SET "legadoAssinatura" = true
WHERE NOT EXISTS (SELECT 1 FROM "assinaturas_saas" a WHERE a."barbeariaId" = "barbearias".id);
COMMIT;
