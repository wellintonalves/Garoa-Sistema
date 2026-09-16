-- Rodar uma única vez pelo registro de migrations, em janela sem novos cadastros.
BEGIN;
ALTER TABLE usuarios ADD COLUMN "aceiteDocumentosEm" TIMESTAMP(3), ADD COLUMN "termosUsoVersao" TEXT,
 ADD COLUMN "privacidadeVersao" TEXT, ADD COLUMN "aceiteDocumentosOrigem" TEXT;
ALTER TABLE barbearias ADD COLUMN "legadoAssinatura" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "avisoMigracaoEm" TIMESTAMP(3), ADD COLUMN "prazoMigracaoAte" TIMESTAMP(3), ADD COLUMN "consultaMigracaoAte" TIMESTAMP(3);
-- Cutoff = início da transação. Prazo de cinco dias só inicia no aviso, não neste backfill.
UPDATE barbearias b SET "legadoAssinatura" = true WHERE b."createdAt" <= transaction_timestamp()
 AND NOT EXISTS (SELECT 1 FROM assinaturas_saas a WHERE a."barbeariaId" = b.id);
COMMIT;
