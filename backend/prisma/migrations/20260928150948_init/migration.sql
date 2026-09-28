-- CreateEnum
CREATE TYPE "tipo_transacao" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "status_transacao" AS ENUM ('EFETIVADA', 'PREVISTA');

-- CreateEnum
CREATE TYPE "essencialidade" AS ENUM ('ESSENCIAL', 'NAO_ESSENCIAL', 'NAO_CLASSIFICADA');

-- CreateEnum
CREATE TYPE "metodo_pagamento" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'TRANSFERENCIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "tipo_anexo_transacao" AS ENUM ('RECIBO', 'OUTRO');

-- CreateEnum
CREATE TYPE "operacao_auditoria" AS ENUM ('CRIACAO', 'EDICAO', 'EXCLUSAO');

-- CreateEnum
CREATE TYPE "frequencia_recorrencia" AS ENUM ('SEMANAL', 'MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "tipo_orcamento" AS ENUM ('MENSAL', 'PERIODO', 'TEMPORARIO', 'EVENTO', 'ZERO_BASED');

-- CreateEnum
CREATE TYPE "tipo_regra_gasto" AS ENUM ('LIMITE_DIARIO', 'LIMITE_CATEGORIA', 'PERCENTUAL_RENDA');

-- CreateEnum
CREATE TYPE "periodo_regra" AS ENUM ('DIARIO', 'SEMANAL', 'MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "base_calculo" AS ENUM ('RENDA_EFETIVADA', 'RENDA_PLANEJADA');

-- CreateEnum
CREATE TYPE "canal_notificacao" AS ENUM ('PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "frequencia_sugestao" AS ENUM ('DIARIA', 'SEMANAL');

-- CreateEnum
CREATE TYPE "tipo_conteudo" AS ENUM ('ARTIGO', 'DICA');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_usuario" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_financeiro" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "moeda_base" CHAR(3) NOT NULL DEFAULT 'BRL',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_perfil_financeiro" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "icone" TEXT,
    "cor" TEXT,
    "ordem" INTEGER,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_categoria" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategoria" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_subcategoria" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_tag" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recorrencia" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "tipo_transacao" "tipo_transacao" NOT NULL,
    "valor" DECIMAL(19,2) NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria_id" UUID,
    "subcategoria_id" UUID,
    "metodo_pagamento" "metodo_pagamento",
    "frequencia" "frequencia_recorrencia" NOT NULL,
    "proxima_ocorrencia" TIMESTAMPTZ(3) NOT NULL,
    "data_termino" DATE,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_recorrencia" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacao" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "tipo" "tipo_transacao" NOT NULL,
    "valor" DECIMAL(19,2) NOT NULL,
    "data_hora" TIMESTAMPTZ(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "anotacao" TEXT,
    "categoria_id" UUID,
    "subcategoria_id" UUID,
    "metodo_pagamento" "metodo_pagamento",
    "essencialidade" "essencialidade" NOT NULL DEFAULT 'NAO_CLASSIFICADA',
    "eh_gasto_livre" BOOLEAN NOT NULL DEFAULT false,
    "status" "status_transacao" NOT NULL,
    "recorrencia_id" UUID,
    "ocorrencia_referencia" TIMESTAMPTZ(3),
    "moeda_original" CHAR(3),
    "valor_original" DECIMAL(19,2),
    "taxa_cambio" DECIMAL(19,8),
    "valor_convertido" DECIMAL(19,2),
    "estabelecimento" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_transacao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacao_tag" (
    "transacao_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "pk_transacao_tag" PRIMARY KEY ("transacao_id","tag_id")
);

-- CreateTable
CREATE TABLE "anexo_transacao" (
    "id" UUID NOT NULL,
    "transacao_id" UUID NOT NULL,
    "tipo" "tipo_anexo_transacao" NOT NULL,
    "arquivo_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_anexo_transacao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria_transacao" (
    "id" UUID NOT NULL,
    "transacao_id" UUID,
    "perfil_id" UUID NOT NULL,
    "operacao" "operacao_auditoria" NOT NULL,
    "estado_anterior" JSONB,
    "estado_novo" JSONB,
    "realizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_auditoria_transacao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacao_transacao" (
    "id" UUID NOT NULL,
    "transacao_id" UUID NOT NULL,
    "nome_participante" TEXT NOT NULL,
    "valor" DECIMAL(19,2),
    "percentual" DECIMAL(7,4),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_participacao_transacao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lembrete_vencimento" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "transacao_id" UUID,
    "recorrencia_id" UUID,
    "notificar_em" TIMESTAMPTZ(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_lembrete_vencimento" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regra_automacao" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "categoria_id" UUID,
    "subcategoria_id" UUID,
    "atributo_alvo" TEXT NOT NULL,
    "valor_destino" JSONB NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_regra_automacao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamento" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "nome" TEXT,
    "tipo" "tipo_orcamento" NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_orcamento" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamento_categoria" (
    "id" UUID NOT NULL,
    "orcamento_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "valor_planejado" DECIMAL(19,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_orcamento_categoria" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacao_orcamento" (
    "transacao_id" UUID NOT NULL,
    "orcamento_id" UUID NOT NULL,

    CONSTRAINT "pk_transacao_orcamento" PRIMARY KEY ("transacao_id","orcamento_id")
);

-- CreateTable
CREATE TABLE "cota_gasto_livre" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor_limite" DECIMAL(19,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_cota_gasto_livre" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regra_gasto" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "tipo" "tipo_regra_gasto" NOT NULL,
    "categoria_id" UUID,
    "valor_limite" DECIMAL(19,2),
    "percentual_limite" DECIMAL(7,4),
    "periodo" "periodo_regra" NOT NULL,
    "base_calculo" "base_calculo",
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_regra_gasto" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regra_gasto_canal" (
    "regra_gasto_id" UUID NOT NULL,
    "canal" "canal_notificacao" NOT NULL,

    CONSTRAINT "pk_regra_gasto_canal" PRIMARY KEY ("regra_gasto_id","canal")
);

-- CreateTable
CREATE TABLE "meta" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "valor_alvo" DECIMAL(19,2) NOT NULL,
    "data_limite" DATE NOT NULL,
    "frequencia_sugestao" "frequencia_sugestao" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_meta" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aporte_meta" (
    "id" UUID NOT NULL,
    "meta_id" UUID NOT NULL,
    "valor" DECIMAL(19,2) NOT NULL,
    "data_hora" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_aporte_meta" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_reflexao" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "entrada_em" TIMESTAMPTZ(3) NOT NULL,
    "duracao_horas" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_item_reflexao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicativo_gatilho" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "nome_aplicativo" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_aplicativo_gatilho" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_consumo" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_diario_consumo" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desafio_economia" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "nome" TEXT,
    "valor_alvo" DECIMAL(19,2) NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_desafio_economia" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conquista" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "icone" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_conquista" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_conquista" (
    "perfil_id" UUID NOT NULL,
    "conquista_id" UUID NOT NULL,
    "conquistada_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_perfil_conquista" PRIMARY KEY ("perfil_id","conquista_id")
);

-- CreateTable
CREATE TABLE "conteudo_educacao" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" "tipo_conteudo" NOT NULL,
    "publicado_em" TIMESTAMPTZ(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_conteudo_educacao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leitura_conteudo" (
    "usuario_id" UUID NOT NULL,
    "conteudo_id" UUID NOT NULL,
    "lido_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_leitura_conteudo" PRIMARY KEY ("usuario_id","conteudo_id")
);

-- CreateTable
CREATE TABLE "plano_grande_compra" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "valor_total" DECIMAL(19,2) NOT NULL,
    "valor_mensal_planejado" DECIMAL(19,2),
    "data_inicio" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_plano_grande_compra" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usuario_email" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "idx_perfil_financeiro_usuario" ON "perfil_financeiro"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_subcategoria_perfil" ON "subcategoria"("perfil_id");

-- CreateIndex
CREATE INDEX "idx_subcategoria_categoria" ON "subcategoria"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subcategoria_perfil_categoria_nome" ON "subcategoria"("perfil_id", "categoria_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tag_perfil_nome" ON "tag"("perfil_id", "nome");

-- CreateIndex
CREATE INDEX "idx_transacao_perfil_data_hora" ON "transacao"("perfil_id", "data_hora");

-- CreateIndex
CREATE INDEX "idx_transacao_perfil_tipo_data_hora" ON "transacao"("perfil_id", "tipo", "data_hora");

-- CreateIndex
CREATE INDEX "idx_transacao_perfil_categoria_data_hora" ON "transacao"("perfil_id", "categoria_id", "data_hora");

-- CreateIndex
CREATE INDEX "idx_transacao_perfil_metodo_data_hora" ON "transacao"("perfil_id", "metodo_pagamento", "data_hora");

-- CreateIndex
CREATE INDEX "idx_transacao_recorrencia" ON "transacao"("recorrencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_transacao_recorrencia_ocorrencia" ON "transacao"("recorrencia_id", "ocorrencia_referencia");

-- CreateIndex
CREATE INDEX "idx_orcamento_perfil_periodo" ON "orcamento"("perfil_id", "data_inicio", "data_fim");

-- CreateIndex
CREATE UNIQUE INDEX "uq_orcamento_categoria" ON "orcamento_categoria"("orcamento_id", "categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cota_gasto_livre_perfil_ano_mes" ON "cota_gasto_livre"("perfil_id", "ano", "mes");

-- CreateIndex
CREATE INDEX "idx_meta_perfil_data_limite" ON "meta"("perfil_id", "data_limite");

-- CreateIndex
CREATE UNIQUE INDEX "uq_conquista_codigo" ON "conquista"("codigo");

-- AddForeignKey
ALTER TABLE "perfil_financeiro" ADD CONSTRAINT "fk_perfil_financeiro_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategoria" ADD CONSTRAINT "fk_subcategoria_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategoria" ADD CONSTRAINT "fk_subcategoria_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "fk_tag_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recorrencia" ADD CONSTRAINT "fk_recorrencia_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recorrencia" ADD CONSTRAINT "fk_recorrencia_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recorrencia" ADD CONSTRAINT "fk_recorrencia_subcategoria" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacao" ADD CONSTRAINT "fk_transacao_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacao" ADD CONSTRAINT "fk_transacao_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacao" ADD CONSTRAINT "fk_transacao_subcategoria" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacao" ADD CONSTRAINT "fk_transacao_recorrencia" FOREIGN KEY ("recorrencia_id") REFERENCES "recorrencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacao_tag" ADD CONSTRAINT "fk_transacao_tag_transacao" FOREIGN KEY ("transacao_id") REFERENCES "transacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacao_tag" ADD CONSTRAINT "fk_transacao_tag_tag" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo_transacao" ADD CONSTRAINT "fk_anexo_transacao_transacao" FOREIGN KEY ("transacao_id") REFERENCES "transacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_transacao" ADD CONSTRAINT "fk_auditoria_transacao_transacao" FOREIGN KEY ("transacao_id") REFERENCES "transacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_transacao" ADD CONSTRAINT "fk_auditoria_transacao_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao_transacao" ADD CONSTRAINT "fk_participacao_transacao_transacao" FOREIGN KEY ("transacao_id") REFERENCES "transacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembrete_vencimento" ADD CONSTRAINT "fk_lembrete_vencimento_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembrete_vencimento" ADD CONSTRAINT "fk_lembrete_vencimento_transacao" FOREIGN KEY ("transacao_id") REFERENCES "transacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembrete_vencimento" ADD CONSTRAINT "fk_lembrete_vencimento_recorrencia" FOREIGN KEY ("recorrencia_id") REFERENCES "recorrencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regra_automacao" ADD CONSTRAINT "fk_regra_automacao_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regra_automacao" ADD CONSTRAINT "fk_regra_automacao_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regra_automacao" ADD CONSTRAINT "fk_regra_automacao_subcategoria" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento" ADD CONSTRAINT "fk_orcamento_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_categoria" ADD CONSTRAINT "fk_orcamento_categoria_orcamento" FOREIGN KEY ("orcamento_id") REFERENCES "orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_categoria" ADD CONSTRAINT "fk_orcamento_categoria_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacao_orcamento" ADD CONSTRAINT "fk_transacao_orcamento_transacao" FOREIGN KEY ("transacao_id") REFERENCES "transacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacao_orcamento" ADD CONSTRAINT "fk_transacao_orcamento_orcamento" FOREIGN KEY ("orcamento_id") REFERENCES "orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cota_gasto_livre" ADD CONSTRAINT "fk_cota_gasto_livre_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regra_gasto" ADD CONSTRAINT "fk_regra_gasto_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regra_gasto" ADD CONSTRAINT "fk_regra_gasto_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regra_gasto_canal" ADD CONSTRAINT "fk_regra_gasto_canal_regra" FOREIGN KEY ("regra_gasto_id") REFERENCES "regra_gasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "fk_meta_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aporte_meta" ADD CONSTRAINT "fk_aporte_meta_meta" FOREIGN KEY ("meta_id") REFERENCES "meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_reflexao" ADD CONSTRAINT "fk_item_reflexao_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicativo_gatilho" ADD CONSTRAINT "fk_aplicativo_gatilho_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_consumo" ADD CONSTRAINT "fk_diario_consumo_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desafio_economia" ADD CONSTRAINT "fk_desafio_economia_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_conquista" ADD CONSTRAINT "fk_perfil_conquista_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_conquista" ADD CONSTRAINT "fk_perfil_conquista_conquista" FOREIGN KEY ("conquista_id") REFERENCES "conquista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leitura_conteudo" ADD CONSTRAINT "fk_leitura_conteudo_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leitura_conteudo" ADD CONSTRAINT "fk_leitura_conteudo_conteudo" FOREIGN KEY ("conteudo_id") REFERENCES "conteudo_educacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_grande_compra" ADD CONSTRAINT "fk_plano_grande_compra_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
