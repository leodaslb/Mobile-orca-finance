-- =============================================================================
-- ORCA FINANCE - MODELO FISICO POSTGRESQL
-- Alinhado ao schema.prisma e ao Modelo de Dados Final.
--
-- Decisoes:
-- - UUID gerado pela aplicacao/Prisma (sem extensao obrigatoria no PostgreSQL).
-- - TIMESTAMPTZ para eventos/horarios; DATE para datas puras.
-- - NUMERIC(19,2) para dinheiro e NUMERIC(19,8) para taxa de cambio.
-- - JSONB para snapshots/configuracoes flexiveis.
-- - Somente CASCADE/SET NULL ja definidos no modelo final.
-- - Demais FKs usam RESTRICT para evitar exclusao implicita nao especificada.
-- =============================================================================

-- ENUMS ----------------------------------------------------------------------

CREATE TYPE tipo_transacao AS ENUM ('RECEITA', 'DESPESA');
CREATE TYPE status_transacao AS ENUM ('EFETIVADA', 'PREVISTA');
CREATE TYPE essencialidade AS ENUM ('ESSENCIAL', 'NAO_ESSENCIAL', 'NAO_CLASSIFICADA');

CREATE TYPE metodo_pagamento AS ENUM (
    'DINHEIRO',
    'PIX',
    'CARTAO_DEBITO',
    'CARTAO_CREDITO',
    'TRANSFERENCIA',
    'OUTRO'
);

CREATE TYPE tipo_anexo_transacao AS ENUM ('RECIBO', 'OUTRO');
CREATE TYPE operacao_auditoria AS ENUM ('CRIACAO', 'EDICAO', 'EXCLUSAO');
CREATE TYPE frequencia_recorrencia AS ENUM ('SEMANAL', 'MENSAL', 'ANUAL');

CREATE TYPE tipo_orcamento AS ENUM (
    'MENSAL',
    'PERIODO',
    'TEMPORARIO',
    'EVENTO',
    'ZERO_BASED'
);

CREATE TYPE tipo_regra_gasto AS ENUM (
    'LIMITE_DIARIO',
    'LIMITE_CATEGORIA',
    'PERCENTUAL_RENDA'
);

CREATE TYPE periodo_regra AS ENUM ('DIARIO', 'SEMANAL', 'MENSAL', 'ANUAL');
CREATE TYPE base_calculo AS ENUM ('RENDA_EFETIVADA', 'RENDA_PLANEJADA');
CREATE TYPE canal_notificacao AS ENUM ('PUSH', 'EMAIL');
CREATE TYPE frequencia_sugestao AS ENUM ('DIARIA', 'SEMANAL');
CREATE TYPE tipo_conteudo AS ENUM ('ARTIGO', 'DICA');


-- IDENTIDADE E PERFIS --------------------------------------------------------

CREATE TABLE usuario (
    id          UUID        NOT NULL,
    nome        TEXT        NOT NULL,
    email       TEXT        NOT NULL,
    senha_hash  TEXT        NOT NULL,
    created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_usuario PRIMARY KEY (id),
    CONSTRAINT uq_usuario_email UNIQUE (email)
);

CREATE TABLE perfil_financeiro (
    id          UUID        NOT NULL,
    usuario_id  UUID        NOT NULL,
    nome        TEXT        NOT NULL,
    moeda_base  CHAR(3)     NOT NULL DEFAULT 'BRL',
    created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_perfil_financeiro PRIMARY KEY (id),
    CONSTRAINT fk_perfil_financeiro_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuario(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX idx_perfil_financeiro_usuario
    ON perfil_financeiro(usuario_id);


-- CATEGORIAS -----------------------------------------------------------------

CREATE TABLE categoria (
    id      UUID        NOT NULL,
    nome    TEXT        NOT NULL,
    icone   TEXT,
    cor     TEXT,
    ordem   INTEGER,
    ativa   BOOLEAN     NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_categoria PRIMARY KEY (id)
);

CREATE TABLE subcategoria (
    id            UUID        NOT NULL,
    perfil_id     UUID        NOT NULL,
    categoria_id  UUID        NOT NULL,
    nome          TEXT        NOT NULL,
    ativa         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_subcategoria PRIMARY KEY (id),
    CONSTRAINT uq_subcategoria_perfil_categoria_nome
        UNIQUE (perfil_id, categoria_id, nome),

    CONSTRAINT fk_subcategoria_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_subcategoria_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categoria(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX idx_subcategoria_perfil
    ON subcategoria(perfil_id);

CREATE INDEX idx_subcategoria_categoria
    ON subcategoria(categoria_id);


-- TAGS -----------------------------------------------------------------------

CREATE TABLE tag (
    id          UUID        NOT NULL,
    perfil_id   UUID        NOT NULL,
    nome        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_tag PRIMARY KEY (id),
    CONSTRAINT uq_tag_perfil_nome UNIQUE (perfil_id, nome),

    CONSTRAINT fk_tag_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- RECORRENCIA ----------------------------------------------------------------

CREATE TABLE recorrencia (
    id                  UUID                    NOT NULL,
    perfil_id           UUID                    NOT NULL,
    tipo_transacao      tipo_transacao          NOT NULL,
    valor               NUMERIC(19,2)           NOT NULL,
    descricao           TEXT                    NOT NULL,
    categoria_id        UUID,
    subcategoria_id     UUID,
    metodo_pagamento    metodo_pagamento,
    frequencia          frequencia_recorrencia  NOT NULL,
    proxima_ocorrencia  TIMESTAMPTZ(3)          NOT NULL,
    data_termino        DATE,
    ativa               BOOLEAN                 NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_recorrencia PRIMARY KEY (id),

    CONSTRAINT fk_recorrencia_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_recorrencia_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categoria(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_recorrencia_subcategoria
        FOREIGN KEY (subcategoria_id)
        REFERENCES subcategoria(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- TRANSACOES -----------------------------------------------------------------

CREATE TABLE transacao (
    id                      UUID                NOT NULL,
    perfil_id               UUID                NOT NULL,
    tipo                    tipo_transacao      NOT NULL,
    valor                   NUMERIC(19,2)       NOT NULL,
    data_hora               TIMESTAMPTZ(3)      NOT NULL,
    descricao               TEXT                NOT NULL,
    anotacao                TEXT,
    categoria_id            UUID,
    subcategoria_id         UUID,
    metodo_pagamento        metodo_pagamento,
    essencialidade          essencialidade      NOT NULL DEFAULT 'NAO_CLASSIFICADA',
    eh_gasto_livre          BOOLEAN             NOT NULL DEFAULT FALSE,
    status                  status_transacao    NOT NULL,
    recorrencia_id          UUID,
    ocorrencia_referencia   TIMESTAMPTZ(3),
    moeda_original          CHAR(3),
    valor_original          NUMERIC(19,2),
    taxa_cambio             NUMERIC(19,8),
    valor_convertido        NUMERIC(19,2),
    estabelecimento         TEXT,
    latitude                NUMERIC(9,6),
    longitude               NUMERIC(9,6),
    created_at              TIMESTAMPTZ(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_transacao PRIMARY KEY (id),
    CONSTRAINT uq_transacao_recorrencia_ocorrencia
        UNIQUE (recorrencia_id, ocorrencia_referencia),

    CONSTRAINT fk_transacao_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_transacao_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categoria(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_transacao_subcategoria
        FOREIGN KEY (subcategoria_id)
        REFERENCES subcategoria(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_transacao_recorrencia
        FOREIGN KEY (recorrencia_id)
        REFERENCES recorrencia(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX idx_transacao_perfil_data_hora
    ON transacao(perfil_id, data_hora);

CREATE INDEX idx_transacao_perfil_tipo_data_hora
    ON transacao(perfil_id, tipo, data_hora);

CREATE INDEX idx_transacao_perfil_categoria_data_hora
    ON transacao(perfil_id, categoria_id, data_hora);

CREATE INDEX idx_transacao_perfil_metodo_data_hora
    ON transacao(perfil_id, metodo_pagamento, data_hora);

CREATE INDEX idx_transacao_recorrencia
    ON transacao(recorrencia_id);


CREATE TABLE transacao_tag (
    transacao_id UUID NOT NULL,
    tag_id       UUID NOT NULL,

    CONSTRAINT pk_transacao_tag PRIMARY KEY (transacao_id, tag_id),

    CONSTRAINT fk_transacao_tag_transacao
        FOREIGN KEY (transacao_id)
        REFERENCES transacao(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_transacao_tag_tag
        FOREIGN KEY (tag_id)
        REFERENCES tag(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE anexo_transacao (
    id            UUID                  NOT NULL,
    transacao_id  UUID                  NOT NULL,
    tipo          tipo_anexo_transacao  NOT NULL,
    arquivo_url   TEXT                  NOT NULL,
    mime_type     TEXT,
    created_at    TIMESTAMPTZ(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_anexo_transacao PRIMARY KEY (id),

    CONSTRAINT fk_anexo_transacao_transacao
        FOREIGN KEY (transacao_id)
        REFERENCES transacao(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


CREATE TABLE auditoria_transacao (
    id                UUID                NOT NULL,
    transacao_id      UUID,
    perfil_id         UUID                NOT NULL,
    operacao          operacao_auditoria  NOT NULL,
    estado_anterior   JSONB,
    estado_novo       JSONB,
    realizado_em      TIMESTAMPTZ(3)      NOT NULL,

    CONSTRAINT pk_auditoria_transacao PRIMARY KEY (id),

    CONSTRAINT fk_auditoria_transacao_transacao
        FOREIGN KEY (transacao_id)
        REFERENCES transacao(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_auditoria_transacao_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE participacao_transacao (
    id                UUID           NOT NULL,
    transacao_id      UUID           NOT NULL,
    nome_participante TEXT           NOT NULL,
    valor             NUMERIC(19,2),
    percentual        NUMERIC(7,4),
    created_at        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_participacao_transacao PRIMARY KEY (id),

    CONSTRAINT fk_participacao_transacao_transacao
        FOREIGN KEY (transacao_id)
        REFERENCES transacao(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


CREATE TABLE lembrete_vencimento (
    id              UUID           NOT NULL,
    perfil_id       UUID           NOT NULL,
    transacao_id    UUID,
    recorrencia_id  UUID,
    notificar_em    TIMESTAMPTZ(3) NOT NULL,
    ativo           BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_lembrete_vencimento PRIMARY KEY (id),

    CONSTRAINT fk_lembrete_vencimento_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_lembrete_vencimento_transacao
        FOREIGN KEY (transacao_id)
        REFERENCES transacao(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_lembrete_vencimento_recorrencia
        FOREIGN KEY (recorrencia_id)
        REFERENCES recorrencia(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- REGRAS DE AUTOMACAO --------------------------------------------------------

CREATE TABLE regra_automacao (
    id               UUID           NOT NULL,
    perfil_id        UUID           NOT NULL,
    categoria_id     UUID,
    subcategoria_id  UUID,
    atributo_alvo    TEXT           NOT NULL,
    valor_destino    JSONB          NOT NULL,
    ativa            BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_regra_automacao PRIMARY KEY (id),

    CONSTRAINT fk_regra_automacao_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_regra_automacao_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categoria(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_regra_automacao_subcategoria
        FOREIGN KEY (subcategoria_id)
        REFERENCES subcategoria(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- RN-CAT-03: unicidade da regra ATIVA por perfil + escopo + atributo
-- fica validada no Service nesta versao academica.


-- ORCAMENTOS -----------------------------------------------------------------

CREATE TABLE orcamento (
    id           UUID            NOT NULL,
    perfil_id    UUID            NOT NULL,
    nome         TEXT,
    tipo         tipo_orcamento  NOT NULL,
    data_inicio  DATE            NOT NULL,
    data_fim     DATE            NOT NULL,
    ativo        BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_orcamento PRIMARY KEY (id),

    CONSTRAINT fk_orcamento_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX idx_orcamento_perfil_periodo
    ON orcamento(perfil_id, data_inicio, data_fim);


CREATE TABLE orcamento_categoria (
    id                UUID           NOT NULL,
    orcamento_id      UUID           NOT NULL,
    categoria_id      UUID           NOT NULL,
    valor_planejado   NUMERIC(19,2)  NOT NULL,
    created_at        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_orcamento_categoria PRIMARY KEY (id),
    CONSTRAINT uq_orcamento_categoria UNIQUE (orcamento_id, categoria_id),

    CONSTRAINT fk_orcamento_categoria_orcamento
        FOREIGN KEY (orcamento_id)
        REFERENCES orcamento(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_orcamento_categoria_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categoria(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE transacao_orcamento (
    transacao_id UUID NOT NULL,
    orcamento_id UUID NOT NULL,

    CONSTRAINT pk_transacao_orcamento PRIMARY KEY (transacao_id, orcamento_id),

    CONSTRAINT fk_transacao_orcamento_transacao
        FOREIGN KEY (transacao_id)
        REFERENCES transacao(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_transacao_orcamento_orcamento
        FOREIGN KEY (orcamento_id)
        REFERENCES orcamento(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE cota_gasto_livre (
    id            UUID           NOT NULL,
    perfil_id     UUID           NOT NULL,
    ano           INTEGER        NOT NULL,
    mes           INTEGER        NOT NULL,
    valor_limite  NUMERIC(19,2)  NOT NULL,
    created_at    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_cota_gasto_livre PRIMARY KEY (id),
    CONSTRAINT uq_cota_gasto_livre_perfil_ano_mes
        UNIQUE (perfil_id, ano, mes),

    CONSTRAINT fk_cota_gasto_livre_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- LIMITES E REGRAS DE GASTO --------------------------------------------------

CREATE TABLE regra_gasto (
    id                  UUID              NOT NULL,
    perfil_id           UUID              NOT NULL,
    tipo                tipo_regra_gasto  NOT NULL,
    categoria_id        UUID,
    valor_limite        NUMERIC(19,2),
    percentual_limite   NUMERIC(7,4),
    periodo             periodo_regra     NOT NULL,
    base_calculo        base_calculo,
    ativa               BOOLEAN           NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_regra_gasto PRIMARY KEY (id),

    CONSTRAINT fk_regra_gasto_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_regra_gasto_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categoria(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE regra_gasto_canal (
    regra_gasto_id UUID               NOT NULL,
    canal          canal_notificacao  NOT NULL,

    CONSTRAINT pk_regra_gasto_canal PRIMARY KEY (regra_gasto_id, canal),

    CONSTRAINT fk_regra_gasto_canal_regra
        FOREIGN KEY (regra_gasto_id)
        REFERENCES regra_gasto(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- METAS ----------------------------------------------------------------------

CREATE TABLE meta (
    id                   UUID                  NOT NULL,
    perfil_id            UUID                  NOT NULL,
    nome                 TEXT                  NOT NULL,
    valor_alvo           NUMERIC(19,2)         NOT NULL,
    data_limite          DATE                  NOT NULL,
    frequencia_sugestao  frequencia_sugestao  NOT NULL,
    created_at           TIMESTAMPTZ(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_meta PRIMARY KEY (id),

    CONSTRAINT fk_meta_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX idx_meta_perfil_data_limite
    ON meta(perfil_id, data_limite);


CREATE TABLE aporte_meta (
    id          UUID           NOT NULL,
    meta_id     UUID           NOT NULL,
    valor       NUMERIC(19,2)  NOT NULL,
    data_hora   TIMESTAMPTZ(3) NOT NULL,
    created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_aporte_meta PRIMARY KEY (id),

    CONSTRAINT fk_aporte_meta_meta
        FOREIGN KEY (meta_id)
        REFERENCES meta(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- REFLEXAO E CONSUMO CONSCIENTE ---------------------------------------------

CREATE TABLE item_reflexao (
    id             UUID           NOT NULL,
    perfil_id      UUID           NOT NULL,
    descricao      TEXT           NOT NULL,
    entrada_em     TIMESTAMPTZ(3) NOT NULL,
    duracao_horas  INTEGER        NOT NULL,
    created_at     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_item_reflexao PRIMARY KEY (id),

    CONSTRAINT fk_item_reflexao_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE aplicativo_gatilho (
    id               UUID           NOT NULL,
    usuario_id       UUID           NOT NULL,
    nome_aplicativo  TEXT           NOT NULL,
    package_name     TEXT           NOT NULL,
    ativo            BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_aplicativo_gatilho PRIMARY KEY (id),

    CONSTRAINT fk_aplicativo_gatilho_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuario(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE diario_consumo (
    id          UUID           NOT NULL,
    perfil_id   UUID           NOT NULL,
    texto       TEXT           NOT NULL,
    created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_diario_consumo PRIMARY KEY (id),

    CONSTRAINT fk_diario_consumo_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- DESAFIOS E GAMIFICACAO -----------------------------------------------------

CREATE TABLE desafio_economia (
    id           UUID           NOT NULL,
    perfil_id    UUID           NOT NULL,
    nome         TEXT,
    valor_alvo   NUMERIC(19,2)  NOT NULL,
    data_inicio  DATE           NOT NULL,
    data_fim     DATE           NOT NULL,
    created_at   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_desafio_economia PRIMARY KEY (id),

    CONSTRAINT fk_desafio_economia_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE conquista (
    id          UUID        NOT NULL,
    codigo      TEXT        NOT NULL,
    nome        TEXT        NOT NULL,
    descricao   TEXT        NOT NULL,
    icone       TEXT,
    ativa       BOOLEAN     NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_conquista PRIMARY KEY (id),
    CONSTRAINT uq_conquista_codigo UNIQUE (codigo)
);


CREATE TABLE perfil_conquista (
    perfil_id       UUID           NOT NULL,
    conquista_id    UUID           NOT NULL,
    conquistada_em  TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT pk_perfil_conquista PRIMARY KEY (perfil_id, conquista_id),

    CONSTRAINT fk_perfil_conquista_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_perfil_conquista_conquista
        FOREIGN KEY (conquista_id)
        REFERENCES conquista(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- EDUCACAO FINANCEIRA --------------------------------------------------------

CREATE TABLE conteudo_educacao (
    id            UUID           NOT NULL,
    titulo        TEXT           NOT NULL,
    conteudo      TEXT           NOT NULL,
    tipo          tipo_conteudo  NOT NULL,
    publicado_em  TIMESTAMPTZ(3),
    ativo         BOOLEAN        NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_conteudo_educacao PRIMARY KEY (id)
);


CREATE TABLE leitura_conteudo (
    usuario_id   UUID           NOT NULL,
    conteudo_id  UUID           NOT NULL,
    lido_em      TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT pk_leitura_conteudo PRIMARY KEY (usuario_id, conteudo_id),

    CONSTRAINT fk_leitura_conteudo_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuario(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_leitura_conteudo_conteudo
        FOREIGN KEY (conteudo_id)
        REFERENCES conteudo_educacao(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- PLANEJAMENTO DE GRANDE COMPRA ---------------------------------------------

CREATE TABLE plano_grande_compra (
    id                       UUID           NOT NULL,
    perfil_id                UUID           NOT NULL,
    nome                     TEXT           NOT NULL,
    valor_total              NUMERIC(19,2)  NOT NULL,
    valor_mensal_planejado   NUMERIC(19,2),
    data_inicio              DATE           NOT NULL,
    created_at               TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_plano_grande_compra PRIMARY KEY (id),

    CONSTRAINT fk_plano_grande_compra_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES perfil_financeiro(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- =============================================================================
-- REGRAS QUE PERMANECEM NO SERVICE / USE CASE
-- =============================================================================
--
-- 1. Perfil pertence ao usuario autenticado.
-- 2. Subcategoria pertence ao mesmo perfil e categoria da transacao.
-- 3. Categoria da transacao:
--      manual normal -> obrigatoria
--      gasto livre   -> pode ser NULL
--      importacao    -> pode ser NULL
-- 4. RegraAutomacao:
--      uma ativa por perfil + escopo + atributoAlvo.
-- 5. LembreteVencimento:
--      deve ter transacao_id OU recorrencia_id.
-- 6. ParticipacaoTransacao:
--      soma por valor deve fechar a transacao OU percentuais devem fechar 100%.
-- 7. Reversao:
--      snapshot de auditoria -> DELETE fisico da Transacao.
-- 8. CotaGastoLivre.mes:
--      validar 1..12.
-- 9. updated_at:
--      mantido automaticamente pelo Prisma via @updatedAt nas escritas do ORM.
-- =============================================================================
