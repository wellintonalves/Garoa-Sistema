-- CreateEnum
CREATE TYPE "IaEstadoReserva" AS ENUM ('RESERVADA', 'ENVIANDO', 'INCERTA', 'CONCLUIDA', 'FALHA_CONFIRMADA');

-- CreateEnum
CREATE TYPE "IaCanal" AS ENUM ('TEXTO', 'VOZ');

-- CreateEnum
CREATE TYPE "IaEstadoSessaoVoz" AS ENUM ('PREPARANDO', 'ATIVA', 'ENCERRANDO', 'ENCERRADA', 'INCERTA');

-- CreateTable
CREATE TABLE "ia_periodos" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "assinaturaId" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fim" TIMESTAMPTZ(3) NOT NULL,
    "plano" "PlanoAssinatura" NOT NULL,
    "politicaVersao" TEXT NOT NULL,
    "tarifaVersao" TEXT NOT NULL,
    "mensagensLimite" INTEGER NOT NULL,
    "mensagensReservadas" INTEGER NOT NULL DEFAULT 0,
    "mensagensConsumidas" INTEGER NOT NULL DEFAULT 0,
    "vozSegundosLimite" INTEGER NOT NULL,
    "vozSegundosReservados" INTEGER NOT NULL DEFAULT 0,
    "vozSegundosConsumidos" INTEGER NOT NULL DEFAULT 0,
    "creditosLimite" INTEGER NOT NULL,
    "creditosReservados" INTEGER NOT NULL DEFAULT 0,
    "creditosConsumidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_periodos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_reservas" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "canal" "IaCanal" NOT NULL,
    "chaveIdempotencia" VARCHAR(128) NOT NULL,
    "pedidoHash" VARCHAR(64) NOT NULL,
    "estado" "IaEstadoReserva" NOT NULL DEFAULT 'RESERVADA',
    "mensagensMaximas" INTEGER NOT NULL,
    "vozSegundosMaximos" INTEGER NOT NULL,
    "creditosMaximos" INTEGER NOT NULL,
    "custoCreditoMicrousd" INTEGER NOT NULL,
    "modelo" TEXT NOT NULL,
    "tarifaEntradaMicrousd" INTEGER NOT NULL,
    "tarifaSaidaMicrousd" INTEGER NOT NULL,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviarAte" TIMESTAMPTZ(3) NOT NULL,
    "atualizadaEm" TIMESTAMPTZ(3) NOT NULL,
    "respostaCifrada" TEXT,
    "resultadoExpiraEm" TIMESTAMPTZ(3),

    CONSTRAINT "ia_reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_usos" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "chaveEvento" TEXT NOT NULL,
    "respostaProvedorId" TEXT NOT NULL,
    "tokensEntrada" INTEGER NOT NULL,
    "tokensSaida" INTEGER NOT NULL,
    "mensagens" INTEGER NOT NULL,
    "vozSegundos" INTEGER NOT NULL,
    "creditos" INTEGER NOT NULL,
    "custoMicrousd" BIGINT NOT NULL,
    "registradoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_usos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_sessoes_voz" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "provedorSessaoId" TEXT,
    "estado" "IaEstadoSessaoVoz" NOT NULL DEFAULT 'PREPARANDO',
    "iniciadaEm" TIMESTAMPTZ(3),
    "ultimaAtividadeEm" TIMESTAMPTZ(3),
    "ocupadaAte" TIMESTAMPTZ(3),
    "encerrarAte" TIMESTAMPTZ(3) NOT NULL,
    "fechamentoSolicitadoEm" TIMESTAMPTZ(3),
    "fechamentoConfirmadoEm" TIMESTAMPTZ(3),
    "motivoEncerramento" TEXT,
    "segundosFaturados" INTEGER,
    "leaseAte" TIMESTAMPTZ(3),
    "leaseVersao" INTEGER NOT NULL DEFAULT 0,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ia_sessoes_voz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ia_periodos_fim_idx" ON "ia_periodos"("fim");

-- CreateIndex
CREATE UNIQUE INDEX "ia_periodos_barbeariaId_inicio_key" ON "ia_periodos"("barbeariaId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "ia_periodos_barbeariaId_id_key" ON "ia_periodos"("barbeariaId", "id");

-- CreateIndex
CREATE INDEX "ia_reservas_estado_enviarAte_idx" ON "ia_reservas"("estado", "enviarAte");

-- CreateIndex
CREATE INDEX "ia_reservas_barbeariaId_usuarioId_criadaEm_idx" ON "ia_reservas"("barbeariaId", "usuarioId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "ia_reservas_barbeariaId_chaveIdempotencia_key" ON "ia_reservas"("barbeariaId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "ia_reservas_barbeariaId_id_key" ON "ia_reservas"("barbeariaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ia_usos_chaveEvento_key" ON "ia_usos"("chaveEvento");

-- CreateIndex
CREATE INDEX "ia_usos_barbeariaId_registradoEm_idx" ON "ia_usos"("barbeariaId", "registradoEm");

-- CreateIndex
CREATE UNIQUE INDEX "ia_usos_barbeariaId_reservaId_key" ON "ia_usos"("barbeariaId", "reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "ia_sessoes_voz_provedorSessaoId_key" ON "ia_sessoes_voz"("provedorSessaoId");

-- CreateIndex
CREATE INDEX "ia_sessoes_voz_estado_encerrarAte_idx" ON "ia_sessoes_voz"("estado", "encerrarAte");

-- CreateIndex
CREATE INDEX "ia_sessoes_voz_estado_leaseAte_idx" ON "ia_sessoes_voz"("estado", "leaseAte");

-- CreateIndex
CREATE UNIQUE INDEX "ia_sessoes_voz_barbeariaId_reservaId_key" ON "ia_sessoes_voz"("barbeariaId", "reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_saas_barbeariaId_id_key" ON "assinaturas_saas"("barbeariaId", "id");

-- AddForeignKey
ALTER TABLE "ia_periodos" ADD CONSTRAINT "ia_periodos_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_periodos" ADD CONSTRAINT "ia_periodos_barbeariaId_assinaturaId_fkey" FOREIGN KEY ("barbeariaId", "assinaturaId") REFERENCES "assinaturas_saas"("barbeariaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_reservas" ADD CONSTRAINT "ia_reservas_barbeariaId_periodoId_fkey" FOREIGN KEY ("barbeariaId", "periodoId") REFERENCES "ia_periodos"("barbeariaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_reservas" ADD CONSTRAINT "ia_reservas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_usos" ADD CONSTRAINT "ia_usos_barbeariaId_reservaId_fkey" FOREIGN KEY ("barbeariaId", "reservaId") REFERENCES "ia_reservas"("barbeariaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_sessoes_voz" ADD CONSTRAINT "ia_sessoes_voz_barbeariaId_reservaId_fkey" FOREIGN KEY ("barbeariaId", "reservaId") REFERENCES "ia_reservas"("barbeariaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariantes monetárias/de franquia, inclusive quando houver outro escritor.
ALTER TABLE ia_periodos ADD CONSTRAINT ia_periodos_limites CHECK (
  inicio < fim AND "mensagensLimite" >= 0 AND "vozSegundosLimite" BETWEEN 0 AND 1800 AND "creditosLimite" > 0
  AND "mensagensReservadas" >= 0 AND "mensagensConsumidas" >= 0
  AND "vozSegundosReservados" >= 0 AND "vozSegundosConsumidos" >= 0
  AND "creditosReservados" >= 0 AND "creditosConsumidos" >= 0
  AND "mensagensReservadas"::bigint + "mensagensConsumidas" <= "mensagensLimite"
  AND "vozSegundosReservados"::bigint + "vozSegundosConsumidos" <= "vozSegundosLimite"
  AND "creditosReservados"::bigint + "creditosConsumidos" <= "creditosLimite"
  AND (plano = 'PRO' OR "vozSegundosLimite" = 0)
);
ALTER TABLE ia_reservas ADD CONSTRAINT ia_reservas_envelope CHECK (
  "creditosMaximos" > 0 AND "custoCreditoMicrousd" > 0
  AND "tarifaEntradaMicrousd" > 0 AND "tarifaSaidaMicrousd" > 0
  AND ((canal = 'TEXTO' AND "mensagensMaximas" = 1 AND "vozSegundosMaximos" = 0)
    OR (canal = 'VOZ' AND "mensagensMaximas" = 0 AND "vozSegundosMaximos" BETWEEN 1 AND 1800))
);
ALTER TABLE ia_usos ADD CONSTRAINT ia_usos_nao_negativos CHECK (
  "tokensEntrada" >= 0 AND "tokensSaida" >= 0 AND mensagens BETWEEN 0 AND 1
  AND "vozSegundos" >= 0 AND creditos >= 0 AND "custoMicrousd" >= 0
);
ALTER TABLE ia_sessoes_voz ADD CONSTRAINT ia_sessoes_uso CHECK ("segundosFaturados" IS NULL OR "segundosFaturados" >= 0);

-- Serializa intervalos por tenant sem exigir extensão no PostgreSQL.
CREATE FUNCTION ia_validar_periodo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."barbeariaId", 0));
  IF EXISTS (SELECT 1 FROM ia_periodos p WHERE p."barbeariaId" = NEW."barbeariaId" AND p.id <> NEW.id AND p.inicio < NEW.fim AND p.fim > NEW.inicio) THEN
    RAISE EXCEPTION 'Períodos de IA sobrepostos' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ia_periodo_sem_sobreposicao BEFORE INSERT OR UPDATE OF inicio, fim, "barbeariaId" ON ia_periodos FOR EACH ROW EXECUTE FUNCTION ia_validar_periodo();

CREATE FUNCTION ia_proteger_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ledger de IA é imutável' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER ia_uso_imutavel BEFORE UPDATE OR DELETE ON ia_usos FOR EACH ROW EXECUTE FUNCTION ia_proteger_ledger();
