-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoTorneo" AS ENUM ('CREADO', 'INSCRIPCIONES_ABIERTAS', 'INSCRIPCIONES_CERRADAS', 'EN_CURSO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "EstadoRonda" AS ENUM ('GENERADA', 'RESULTADOS_EN_REGISTRO', 'CLASIFICACION_ACTUALIZADA');

-- CreateEnum
CREATE TYPE "EstadoPartida" AS ENUM ('PROGRAMADA', 'EN_JUEGO', 'FINALIZADA', 'CORREGIDA');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "rol_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jugadores" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "codigo_universitario" TEXT NOT NULL,
    "programa" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL,

    CONSTRAINT "jugadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "torneos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoTorneo" NOT NULL DEFAULT 'CREADO',
    "formato" TEXT NOT NULL DEFAULT 'suizo',
    "organizador_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torneos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rondas" (
    "id" TEXT NOT NULL,
    "torneo_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "estado" "EstadoRonda" NOT NULL DEFAULT 'GENERADA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rondas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partidas" (
    "id" TEXT NOT NULL,
    "ronda_id" TEXT NOT NULL,
    "mesa" INTEGER NOT NULL,
    "id_blancas" TEXT,
    "id_negras" TEXT,
    "estado" "EstadoPartida" NOT NULL DEFAULT 'PROGRAMADA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados" (
    "id" TEXT NOT NULL,
    "partida_id" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criterios_desempate" (
    "id" TEXT NOT NULL,
    "torneo_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "criterios_desempate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clasificacion" (
    "id" TEXT NOT NULL,
    "torneo_id" TEXT NOT NULL,
    "jugador_id" TEXT NOT NULL,
    "puntaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "buchholz" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "buchholz_c1" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "sonneborn_berger" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "aro" DECIMAL(6,2) NOT NULL DEFAULT 0,

    CONSTRAINT "clasificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "jugadores_usuario_id_key" ON "jugadores"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "rondas_torneo_id_numero_key" ON "rondas"("torneo_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_partida_id_key" ON "resultados"("partida_id");

-- CreateIndex
CREATE UNIQUE INDEX "criterios_desempate_torneo_id_orden_key" ON "criterios_desempate"("torneo_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "clasificacion_torneo_id_jugador_id_key" ON "clasificacion"("torneo_id", "jugador_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jugadores" ADD CONSTRAINT "jugadores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneos" ADD CONSTRAINT "torneos_organizador_id_fkey" FOREIGN KEY ("organizador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rondas" ADD CONSTRAINT "rondas_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "torneos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_ronda_id_fkey" FOREIGN KEY ("ronda_id") REFERENCES "rondas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_id_blancas_fkey" FOREIGN KEY ("id_blancas") REFERENCES "jugadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_id_negras_fkey" FOREIGN KEY ("id_negras") REFERENCES "jugadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados" ADD CONSTRAINT "resultados_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "partidas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criterios_desempate" ADD CONSTRAINT "criterios_desempate_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "torneos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clasificacion" ADD CONSTRAINT "clasificacion_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "torneos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clasificacion" ADD CONSTRAINT "clasificacion_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "jugadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint (Restricción de integridad #2: id_blancas != id_negras)
-- No expresable de forma declarativa en Prisma; se agrega a mano.
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_blancas_negras_check"
  CHECK ("id_blancas" IS NULL OR "id_negras" IS NULL OR "id_blancas" <> "id_negras");

-- AddCheckConstraint (Restricción de integridad #3: catálogo de resultados válidos, RN-03)
ALTER TABLE "resultados" ADD CONSTRAINT "resultados_valor_check"
  CHECK ("valor" IN ('1-0', '0-1', '1/2-1/2', 'BYE'));

