-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'BARBEIRO', 'CLIENTE');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('AGUARDANDO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO');

-- CreateEnum
CREATE TYPE "TipoRecompensa" AS ENUM ('SERVICO_GRATIS', 'DESCONTO_PERCENTUAL', 'DESCONTO_REAIS');

-- CreateEnum
CREATE TYPE "RemetenteMensagem" AS ENUM ('CLIENTE', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoDesconto" AS ENUM ('NENHUM', 'REAIS', 'PERCENTUAL', 'PONTOS', 'COMBINADO');

-- CreateEnum
CREATE TYPE "TipoTransacaoPontos" AS ENUM ('ACUMULO', 'RESGATE', 'AJUSTE_MANUAL', 'ESTORNO');

-- CreateEnum
CREATE TYPE "StatusAprovacao" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "StatusResgate" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "BaseCalculoComissao" AS ENUM ('VALOR_BRUTO', 'VALOR_LIQUIDO');

-- CreateEnum
CREATE TYPE "BaseCalculoPontos" AS ENUM ('VALOR_BRUTO', 'VALOR_LIQUIDO');

-- CreateTable
CREATE TABLE "barbearias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "telefone" TEXT,
    "endereco" TEXT,
    "logo" TEXT,
    "corPrimaria" TEXT DEFAULT '#FF8C00',
    "corSecundaria" TEXT DEFAULT '#1A1A1A',
    "corTexto" TEXT DEFAULT '#FFFFFF',
    "fonte" TEXT DEFAULT 'Inter',
    "fonteCorpo" TEXT DEFAULT 'Inter',
    "fonteNumeros" TEXT DEFAULT 'DM Mono',
    "horarioAbertura" TEXT DEFAULT '09:00',
    "horarioFechamento" TEXT DEFAULT '19:00',
    "temAlmoco" BOOLEAN NOT NULL DEFAULT false,
    "horarioAlmocoInicio" TEXT DEFAULT '12:00',
    "horarioAlmocoFim" TEXT DEFAULT '13:00',
    "diasFuncionamento" TEXT[] DEFAULT ARRAY['1', '2', '3', '4', '5', '6']::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barbearias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'CLIENTE',
    "barbeariaId" TEXT,
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "codigoVerificacao" TEXT,
    "codigoExpiracao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barbeiros" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "foto" TEXT,
    "especialidades" TEXT[],
    "comissaoPercent" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "cor" TEXT DEFAULT '#F97316',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "trabalhandoAgora" BOOLEAN NOT NULL DEFAULT false,
    "telefone" TEXT,
    "horariosTrabalho" JSONB,
    "avaliacaoMedia" DOUBLE PRECISION DEFAULT 5.0,

    CONSTRAINT "barbeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueios_agenda" (
    "id" TEXT NOT NULL,
    "barbeiroId" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueios_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "telefone" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "observacoes" TEXT,
    "codigoIndicacao" TEXT,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes_barbearias" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "conectadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_barbearias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontos_fidelidade" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "agendamentoId" TEXT,
    "lancamentoId" TEXT,
    "tipo" "TipoTransacaoPontos" NOT NULL DEFAULT 'ACUMULO',
    "pontos" INTEGER NOT NULL,
    "saldoApos" INTEGER NOT NULL DEFAULT 0,
    "descricao" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pontos_fidelidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "preco" DECIMAL(10,2) NOT NULL,
    "duracaoMinutos" INTEGER NOT NULL,
    "comissaoPercent" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "cor" TEXT DEFAULT '#22C55E',
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "clienteId" TEXT NOT NULL,
    "barbeiroId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "servicosIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dataHora" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'AGUARDANDO',
    "observacoes" TEXT,
    "valorCobrado" DECIMAL(10,2) NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'SISTEMA',
    "valorBruto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipoDesconto" "TipoDesconto" NOT NULL DEFAULT 'NENHUM',
    "descontoManual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "descontoPercentualAplic" DECIMAL(10,2),
    "pontosUtilizados" INTEGER NOT NULL DEFAULT 0,
    "descontoPontos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorDesconto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorLiquido" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_financeiros" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "tipo" "TipoLancamento" NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "agendamentoId" TEXT,
    "clienteId" TEXT,
    "barbeiroId" TEXT,
    "servicoId" TEXT,
    "valorComissao" DECIMAL(10,2),
    "valorLiquido" DECIMAL(10,2),
    "percentualComissao" DECIMAL(10,2),
    "baseComissaoAplicada" "BaseCalculoComissao",
    "data" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamentos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "quantidade" INTEGER NOT NULL,
    "unidade" TEXT NOT NULL,
    "quantidadeMinima" INTEGER NOT NULL DEFAULT 5,
    "custo" DECIMAL(10,2) NOT NULL,
    "precoVenda" DECIMAL(10,2),

    CONSTRAINT "estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas_produtos" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "estoqueId" TEXT,
    "vendaId" TEXT,
    "nomeProduto" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoVenda" DECIMAL(10,2) NOT NULL,
    "custoUnitario" DECIMAL(10,2) NOT NULL,
    "lucro" DECIMAL(10,2) NOT NULL,
    "descontoRateado" DECIMAL(10,2),
    "formaPagamento" "FormaPagamento" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendas_produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas_estoque" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "chaveRequisicao" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "valorBruto" DECIMAL(10,2),
    "tipoDesconto" "TipoDesconto",
    "valorDesconto" DECIMAL(10,2),
    "descontoManual" DECIMAL(10,2),
    "descontoPontos" DECIMAL(10,2),
    "descontoPercentual" DECIMAL(10,2),
    "pontosUtilizados" INTEGER,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lancamentoId" TEXT NOT NULL,
    "estornadaEm" TIMESTAMP(3),
    "motivoEstorno" TEXT,
    "estornadoPorId" TEXT,
    "estornoLancamentoId" TEXT,

    CONSTRAINT "vendas_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "horariosFuncionamento" JSONB,
    "regrasFidelidade" JSONB,
    "baseCalculoComissao" "BaseCalculoComissao" NOT NULL DEFAULT 'VALOR_LIQUIDO',
    "baseCalculoPontos" "BaseCalculoPontos" NOT NULL DEFAULT 'VALOR_LIQUIDO',

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_fidelidade" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "pontosPorReal" INTEGER NOT NULL DEFAULT 0,
    "pontosPorVisita" INTEGER NOT NULL DEFAULT 0,
    "pontosDobroAniversario" BOOLEAN NOT NULL DEFAULT false,
    "pontosPorIndicacao" INTEGER NOT NULL DEFAULT 0,
    "pontosParaIndicado" INTEGER NOT NULL DEFAULT 0,
    "pontosBoasVindas" INTEGER NOT NULL DEFAULT 0,
    "valorPorPonto" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "regrasPorServico" JSONB,
    "resgatePontosAtivo" BOOLEAN NOT NULL DEFAULT false,
    "percentualMaxPontos" INTEGER NOT NULL DEFAULT 30,
    "descontoMaxReais" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "descontoMaxPercentual" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "permitirCombinarDescontos" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_fidelidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recompensas" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" "TipoRecompensa" NOT NULL,
    "valorDesconto" DECIMAL(10,2),
    "servicoId" TEXT,
    "pontosNecessarios" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recompensas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resgates_recompensa" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "recompensaId" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "pontosUsados" INTEGER NOT NULL,
    "status" "StatusResgate" NOT NULL DEFAULT 'PENDENTE',
    "confirmadoPor" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resgates_recompensa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_mensagens" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "clienteId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "remetente" "RemetenteMensagem" NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicacoes" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "indicadorId" TEXT NOT NULL,
    "indicadoId" TEXT NOT NULL,
    "pontosAwardados" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprovacoes_edicao" (
    "id" TEXT NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "barbeiroId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "dadosNovos" JSONB,
    "status" "StatusAprovacao" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprovacoes_edicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boas_vindas_concedidas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boas_vindas_concedidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "barbeiroId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_remarcacoes" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "dataHoraAnterior" TIMESTAMP(3) NOT NULL,
    "dataHoraNova" TIMESTAMP(3) NOT NULL,
    "barbeiroAnteriorId" TEXT,
    "barbeiroNovoId" TEXT,
    "servicoAnteriorId" TEXT,
    "servicoNovoId" TEXT,
    "usuarioAcaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_remarcacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_atendimento" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT,
    "agendamentoId" TEXT,
    "lancamentoId" TEXT,
    "servicoId" TEXT,
    "nome" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "duracaoMinutos" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itens_atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barbearias_slug_key" ON "barbearias"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_barbeariaId_key" ON "usuarios"("email", "barbeariaId");

-- CreateIndex
CREATE UNIQUE INDEX "barbeiros_usuarioId_key" ON "barbeiros"("usuarioId");

-- CreateIndex
CREATE INDEX "barbeiros_barbeariaId_idx" ON "barbeiros"("barbeariaId");

-- CreateIndex
CREATE INDEX "bloqueios_agenda_barbeiroId_idx" ON "bloqueios_agenda"("barbeiroId");

-- CreateIndex
CREATE INDEX "bloqueios_agenda_dataInicio_dataFim_idx" ON "bloqueios_agenda"("dataInicio", "dataFim");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_usuarioId_key" ON "clientes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_codigoIndicacao_key" ON "clientes"("codigoIndicacao");

-- CreateIndex
CREATE INDEX "clientes_barbeariaId_idx" ON "clientes"("barbeariaId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_barbearias_clienteId_barbeariaId_key" ON "clientes_barbearias"("clienteId", "barbeariaId");

-- CreateIndex
CREATE UNIQUE INDEX "pontos_fidelidade_agendamentoId_key" ON "pontos_fidelidade"("agendamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "pontos_fidelidade_lancamentoId_key" ON "pontos_fidelidade"("lancamentoId");

-- CreateIndex
CREATE INDEX "agendamentos_barbeariaId_dataHora_idx" ON "agendamentos"("barbeariaId", "dataHora");

-- CreateIndex
CREATE INDEX "agendamentos_clienteId_idx" ON "agendamentos"("clienteId");

-- CreateIndex
CREATE INDEX "agendamentos_barbeiroId_idx" ON "agendamentos"("barbeiroId");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_barbeariaId_data_idx" ON "lancamentos_financeiros"("barbeariaId", "data");

-- CreateIndex
CREATE INDEX "estoque_barbeariaId_idx" ON "estoque"("barbeariaId");

-- CreateIndex
CREATE INDEX "vendas_produtos_vendaId_idx" ON "vendas_produtos"("vendaId");

-- CreateIndex
CREATE INDEX "vendas_produtos_barbeariaId_data_idx" ON "vendas_produtos"("barbeariaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "vendas_estoque_lancamentoId_key" ON "vendas_estoque"("lancamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "vendas_estoque_estornoLancamentoId_key" ON "vendas_estoque"("estornoLancamentoId");

-- CreateIndex
CREATE INDEX "vendas_estoque_barbeariaId_data_idx" ON "vendas_estoque"("barbeariaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "vendas_estoque_barbeariaId_chaveRequisicao_key" ON "vendas_estoque"("barbeariaId", "chaveRequisicao");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_barbeariaId_key" ON "configuracoes"("barbeariaId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_fidelidade_barbeariaId_key" ON "configuracoes_fidelidade"("barbeariaId");

-- CreateIndex
CREATE UNIQUE INDEX "boas_vindas_concedidas_clienteId_barbeariaId_key" ON "boas_vindas_concedidas"("clienteId", "barbeariaId");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_agendamentoId_key" ON "avaliacoes"("agendamentoId");

-- CreateIndex
CREATE INDEX "avaliacoes_barbeiroId_idx" ON "avaliacoes"("barbeiroId");

-- CreateIndex
CREATE INDEX "historico_remarcacoes_agendamentoId_idx" ON "historico_remarcacoes"("agendamentoId");

-- CreateIndex
CREATE INDEX "itens_atendimento_barbeariaId_idx" ON "itens_atendimento"("barbeariaId");

-- CreateIndex
CREATE INDEX "itens_atendimento_agendamentoId_idx" ON "itens_atendimento"("agendamentoId");

-- CreateIndex
CREATE INDEX "itens_atendimento_lancamentoId_idx" ON "itens_atendimento"("lancamentoId");

-- CreateIndex
CREATE INDEX "itens_atendimento_servicoId_idx" ON "itens_atendimento"("servicoId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barbeiros" ADD CONSTRAINT "barbeiros_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barbeiros" ADD CONSTRAINT "barbeiros_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueios_agenda" ADD CONSTRAINT "bloqueios_agenda_barbeiroId_fkey" FOREIGN KEY ("barbeiroId") REFERENCES "barbeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_barbearias" ADD CONSTRAINT "clientes_barbearias_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_barbearias" ADD CONSTRAINT "clientes_barbearias_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_fidelidade" ADD CONSTRAINT "pontos_fidelidade_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_fidelidade" ADD CONSTRAINT "pontos_fidelidade_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_fidelidade" ADD CONSTRAINT "pontos_fidelidade_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamentos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_barbeiroId_fkey" FOREIGN KEY ("barbeiroId") REFERENCES "barbeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_barbeiroId_fkey" FOREIGN KEY ("barbeiroId") REFERENCES "barbeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque" ADD CONSTRAINT "estoque_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas_produtos" ADD CONSTRAINT "vendas_produtos_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas_produtos" ADD CONSTRAINT "vendas_produtos_estoqueId_fkey" FOREIGN KEY ("estoqueId") REFERENCES "estoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas_produtos" ADD CONSTRAINT "vendas_produtos_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas_estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas_estoque" ADD CONSTRAINT "vendas_estoque_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas_estoque" ADD CONSTRAINT "vendas_estoque_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas_estoque" ADD CONSTRAINT "vendas_estoque_estornoLancamentoId_fkey" FOREIGN KEY ("estornoLancamentoId") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes" ADD CONSTRAINT "configuracoes_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_fidelidade" ADD CONSTRAINT "configuracoes_fidelidade_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recompensas" ADD CONSTRAINT "recompensas_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recompensas" ADD CONSTRAINT "recompensas_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resgates_recompensa" ADD CONSTRAINT "resgates_recompensa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resgates_recompensa" ADD CONSTRAINT "resgates_recompensa_recompensaId_fkey" FOREIGN KEY ("recompensaId") REFERENCES "recompensas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resgates_recompensa" ADD CONSTRAINT "resgates_recompensa_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mensagens" ADD CONSTRAINT "chat_mensagens_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mensagens" ADD CONSTRAINT "chat_mensagens_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicacoes" ADD CONSTRAINT "indicacoes_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicacoes" ADD CONSTRAINT "indicacoes_indicadorId_fkey" FOREIGN KEY ("indicadorId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicacoes" ADD CONSTRAINT "indicacoes_indicadoId_fkey" FOREIGN KEY ("indicadoId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_edicao" ADD CONSTRAINT "aprovacoes_edicao_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamentos_financeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_edicao" ADD CONSTRAINT "aprovacoes_edicao_barbeiroId_fkey" FOREIGN KEY ("barbeiroId") REFERENCES "barbeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_barbeiroId_fkey" FOREIGN KEY ("barbeiroId") REFERENCES "barbeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_barbeiroAnteriorId_fkey" FOREIGN KEY ("barbeiroAnteriorId") REFERENCES "barbeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_barbeiroNovoId_fkey" FOREIGN KEY ("barbeiroNovoId") REFERENCES "barbeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_servicoAnteriorId_fkey" FOREIGN KEY ("servicoAnteriorId") REFERENCES "servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_servicoNovoId_fkey" FOREIGN KEY ("servicoNovoId") REFERENCES "servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_remarcacoes" ADD CONSTRAINT "historico_remarcacoes_usuarioAcaoId_fkey" FOREIGN KEY ("usuarioAcaoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_atendimento" ADD CONSTRAINT "itens_atendimento_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_atendimento" ADD CONSTRAINT "itens_atendimento_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamentos_financeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_atendimento" ADD CONSTRAINT "itens_atendimento_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_atendimento" ADD CONSTRAINT "itens_atendimento_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
