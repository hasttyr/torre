-- AlterTable
ALTER TABLE "torneos" ADD COLUMN     "numero_rondas" INTEGER,
ADD COLUMN     "ritmo" TEXT;

-- CreateTable
CREATE TABLE "inscripciones" (
    "id" TEXT NOT NULL,
    "torneo_id" TEXT NOT NULL,
    "jugador_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_torneo_id_jugador_id_key" ON "inscripciones"("torneo_id", "jugador_id");

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "torneos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "jugadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
