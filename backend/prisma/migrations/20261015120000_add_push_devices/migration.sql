-- CreateTable
CREATE TABLE "dispositivo_push" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_dispositivo_push" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_dispositivo_push_usuario" ON "dispositivo_push"("usuario_id");

-- AddForeignKey
ALTER TABLE "dispositivo_push" ADD CONSTRAINT "fk_dispositivo_push_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
