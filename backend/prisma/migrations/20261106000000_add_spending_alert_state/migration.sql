CREATE TABLE "estado_alerta_regra_gasto" (
    "regra_gasto_id" UUID NOT NULL,
    "inicio_periodo" TIMESTAMPTZ(3) NOT NULL,
    "violada" BOOLEAN NOT NULL DEFAULT false,
    "ciclo" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "pk_estado_alerta_regra_gasto" PRIMARY KEY ("regra_gasto_id"),
    CONSTRAINT "fk_estado_alerta_regra" FOREIGN KEY ("regra_gasto_id") REFERENCES "regra_gasto"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
