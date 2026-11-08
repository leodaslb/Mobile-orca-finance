-- AlterTable
ALTER TABLE "desafio_economia" ADD COLUMN     "categoria_id" UUID,
ADD COLUMN     "percentual_reducao" DECIMAL(7,4),
ADD COLUMN     "valor_meta_periodo" DECIMAL(19,2),
ADD COLUMN     "valor_referencia" DECIMAL(19,2),
ALTER COLUMN "valor_alvo" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "idx_desafio_economia_perfil_categoria_periodo" ON "desafio_economia"("perfil_id", "categoria_id", "data_inicio", "data_fim");

-- AddForeignKey
ALTER TABLE "desafio_economia" ADD CONSTRAINT "fk_desafio_economia_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
