-- ADITIVO. Revisar drift/backup e aplicar ANTES do novo backend, em janela autorizada.
-- Não executar automaticamente no boot/deploy.
-- PostgreSQL 11+: default constante é metadado, sem reescrita da tabela de usuários.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS limites_autenticacao (
  chave VARCHAR(96) PRIMARY KEY,
  tentativas INTEGER NOT NULL,
  "expiraEm" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "limites_autenticacao_expiraEm_idx" ON limites_autenticacao ("expiraEm");

COMMIT;
