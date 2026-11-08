-- CreateTable
CREATE TABLE "reserva_lembrete_transacao" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "chave_evento" TEXT NOT NULL,
    "dia_envio" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_reserva_lembrete_transacao" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_reserva_lembrete_usuario_dia" ON "reserva_lembrete_transacao"("usuario_id", "dia_envio");

-- CreateIndex
CREATE UNIQUE INDEX "uq_reserva_lembrete_usuario_evento" ON "reserva_lembrete_transacao"("usuario_id", "chave_evento");

-- AddForeignKey
ALTER TABLE "reserva_lembrete_transacao" ADD CONSTRAINT "fk_reserva_lembrete_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_lembrete_transacao" ADD CONSTRAINT "fk_reserva_lembrete_perfil" FOREIGN KEY ("perfil_id") REFERENCES "perfil_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
