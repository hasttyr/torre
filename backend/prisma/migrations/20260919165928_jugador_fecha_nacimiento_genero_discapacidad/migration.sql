-- CreateEnum
CREATE TYPE "GeneroJugador" AS ENUM ('MASCULINO', 'FEMENINO', 'NO_BINARIO', 'PREFIERE_NO_DECIR');

-- CreateEnum
CREATE TYPE "DiscapacidadJugador" AS ENUM ('NINGUNA', 'FISICA_MOTRIZ', 'VISUAL', 'AUDITIVA', 'COGNITIVA', 'PSICOSOCIAL', 'MULTIPLE', 'OTRA');

-- AlterTable
ALTER TABLE "jugadores" ADD COLUMN     "discapacidad" "DiscapacidadJugador",
ADD COLUMN     "fecha_nacimiento" TIMESTAMP(3),
ADD COLUMN     "genero" "GeneroJugador";
