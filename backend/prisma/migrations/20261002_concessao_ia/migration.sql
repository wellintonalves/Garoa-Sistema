-- Extensão aditiva: preserva assinaturas, períodos, reservas e ledger existentes.
CREATE TABLE ia_concessoes (
  id TEXT PRIMARY KEY,
  "barbeariaId" TEXT NOT NULL UNIQUE REFERENCES barbearias(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  inicio TIMESTAMPTZ(3) NOT NULL,
  fim TIMESTAMPTZ(3) NOT NULL,
  "mensagensLimite" INTEGER NOT NULL,
  "creditosLimite" INTEGER NOT NULL,
  "custoCreditoMicrousd" INTEGER NOT NULL,
  revogada BOOLEAN NOT NULL DEFAULT false,
  "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ia_concessoes_limites CHECK (fim > inicio AND "mensagensLimite" BETWEEN 1 AND 100
    AND "creditosLimite" BETWEEN 1 AND 2000000 AND "custoCreditoMicrousd" = 1),
  CONSTRAINT "ia_concessoes_barbeariaId_id_key" UNIQUE ("barbeariaId",id)
);
ALTER TABLE ia_periodos ALTER COLUMN "assinaturaId" DROP NOT NULL;
ALTER TABLE ia_periodos ADD COLUMN "concessaoId" TEXT;
CREATE UNIQUE INDEX "ia_periodos_concessaoId_key" ON ia_periodos("concessaoId");
ALTER TABLE ia_periodos ADD CONSTRAINT "ia_periodos_barbeariaId_concessaoId_fkey"
  FOREIGN KEY ("barbeariaId","concessaoId") REFERENCES ia_concessoes("barbeariaId",id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE ia_periodos ADD CONSTRAINT ia_periodos_fonte_unica CHECK (
  ("assinaturaId" IS NOT NULL)::int + ("concessaoId" IS NOT NULL)::int = 1);

-- Não permite renovar a concessão mudando datas, limites ou identidade.
CREATE FUNCTION ia_proteger_concessao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'revogada') IS DISTINCT FROM (to_jsonb(OLD) - 'revogada') OR (OLD.revogada AND NOT NEW.revogada) THEN
    RAISE EXCEPTION 'Concessao de IA imutavel; somente revogacao permitida' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ia_concessao_imutavel BEFORE UPDATE ON ia_concessoes FOR EACH ROW EXECUTE FUNCTION ia_proteger_concessao();

-- Ciclo pago pode coexistir com concessão; cada fonte mantém seu próprio ledger.
-- O resolvedor sempre prioriza o ciclo pago válido, sem transferir/resetar saldo.
CREATE OR REPLACE FUNCTION ia_validar_periodo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."barbeariaId", 0));
  IF EXISTS (SELECT 1 FROM ia_periodos p WHERE p."barbeariaId" = NEW."barbeariaId" AND p.id <> NEW.id
    AND p.inicio < NEW.fim AND p.fim > NEW.inicio
    AND (p."concessaoId" IS NULL) = (NEW."concessaoId" IS NULL)) THEN
    RAISE EXCEPTION 'Periodos de IA sobrepostos' USING ERRCODE = '23514';
  END IF;
  IF NEW."concessaoId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM ia_concessoes c WHERE c.id = NEW."concessaoId" AND c."barbeariaId" = NEW."barbeariaId"
    AND c.inicio = NEW.inicio AND c.fim = NEW.fim AND c."mensagensLimite" = NEW."mensagensLimite"
    AND c."creditosLimite" = NEW."creditosLimite" AND NEW."vozSegundosLimite" = 0 AND NEW.plano = 'BASICO'
  ) THEN
    RAISE EXCEPTION 'Periodo diverge da concessao de IA' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
-- Valida também tentativas de troca de fonte/limites, sem remover proteção anterior.
CREATE TRIGGER ia_periodo_validar_concessao BEFORE UPDATE OF "concessaoId", "assinaturaId", "mensagensLimite", "creditosLimite", "vozSegundosLimite", plano
  ON ia_periodos FOR EACH ROW EXECUTE FUNCTION ia_validar_periodo();
