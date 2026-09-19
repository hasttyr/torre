-- CreateEnum
CREATE TYPE "TipoSolicitudDatos" AS ENUM ('ACCESO', 'RECTIFICACION', 'SUPRESION');

-- CreateEnum
CREATE TYPE "EstadoSolicitudDatos" AS ENUM ('RESUELTA', 'BLOQUEADA');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "consentimiento_aceptado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentimiento_fecha" TIMESTAMP(3),
ADD COLUMN     "consentimiento_version" TEXT;

-- CreateTable
CREATE TABLE "solicitudes_recuperacion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_datos_personales" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "TipoSolicitudDatos" NOT NULL,
    "estado" "EstadoSolicitudDatos" NOT NULL,
    "detalle" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_datos_personales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_recuperacion_token_hash_key" ON "solicitudes_recuperacion"("token_hash");

-- AddForeignKey
ALTER TABLE "solicitudes_recuperacion" ADD CONSTRAINT "solicitudes_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_datos_personales" ADD CONSTRAINT "solicitudes_datos_personales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
