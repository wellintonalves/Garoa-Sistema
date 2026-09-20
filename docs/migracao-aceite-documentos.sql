-- Adição somente. Sem backfill de aceite e sem exclusão/alteração de histórico.
-- Aplicar primeiro em banco descartável; não executar em produção automaticamente.
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "aceiteDocumentosEm" TIMESTAMP(3);
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "termosUsoVersao" TEXT;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "privacidadeVersao" TEXT;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "aceiteDocumentosOrigem" TEXT;
-- Campos nulos indicam ausência de registro de aceite, não consentimento implícito.
