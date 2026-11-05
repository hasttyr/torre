import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";

import { confirmPasswordResetSchema, loginSchema, registerSchema } from "./auth.schemas";
import { createClubSchema } from "./clubs.schemas";
import { idSchema } from "./fields";
import { correctResultSchema, generateRoundSchema, recordResultSchema, swapPlayersSchema } from "./rounds.schemas";
import { configureTournamentSchema, createTournamentSchema } from "./tournaments.schemas";
import { notificationSettingsSchema, updateProfileSchema } from "./users.schemas";

// The black-box cases of the test plan (docs/plan-de-pruebas.md, section
// 8.1.1): each entry is one equivalence class or boundary value of an input,
// derived from the requirement, not from the code. The ID in each test name
// is the plan's, so a failing test points at its row in the plan.

const UUID = "3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b";
const text = (length: number) => "a".repeat(length);

const coach = {
  name: "Ana Torres",
  email: "ana@uni.edu",
  password: "password123",
  role: "COACH",
  acceptDataPolicy: true,
};
const player = { ...coach, role: "PLAYER", universityCode: "U100", program: "Ingeniería de Sistemas", semester: 3 };
const tournament = { name: "Copa Central", startDate: "2026-10-01", endDate: "2026-10-03" };

type Case = [id: string, description: string, schema: ZodType, input: unknown, valid: boolean];

const cases: Case[] = [
  // RF01 / HU01: register an account.
  ["CB-01", "nombre de 1 carácter (bajo el mínimo)", registerSchema, { ...coach, name: "A" }, false],
  ["CB-01", "nombre de 2 caracteres (en el mínimo)", registerSchema, { ...coach, name: "Al" }, true],
  ["CB-01", "nombre de 100 caracteres (en el máximo)", registerSchema, { ...coach, name: text(100) }, true],
  ["CB-01", "nombre de 101 caracteres (sobre el máximo)", registerSchema, { ...coach, name: text(101) }, false],
  ["CB-01", "nombre de solo espacios", registerSchema, { ...coach, name: "    " }, false],
  ["CB-02", "correo con formato válido", registerSchema, coach, true],
  ["CB-02", "correo sin @", registerSchema, { ...coach, email: "ana.uni.edu" }, false],
  ["CB-02", "correo vacío", registerSchema, { ...coach, email: "" }, false],
  ["CB-03", "contraseña de 7 caracteres (bajo el mínimo)", registerSchema, { ...coach, password: text(7) }, false],
  ["CB-03", "contraseña de 8 caracteres (en el mínimo)", registerSchema, { ...coach, password: text(8) }, true],
  ["CB-03", "contraseña de 128 caracteres (en el máximo)", registerSchema, { ...coach, password: text(128) }, true],
  ["CB-03", "contraseña de 129 caracteres (sobre el máximo)", registerSchema, { ...coach, password: text(129) }, false],
  ["CB-04", "rol jugador con sus datos académicos", registerSchema, player, true],
  ["CB-04", "rol entrenador", registerSchema, coach, true],
  ["CB-04", "rol organizador (no es de autoservicio)", registerSchema, { ...coach, role: "ORGANIZER" }, false],
  ["CB-04", "rol árbitro (no es de autoservicio)", registerSchema, { ...coach, role: "ARBITER" }, false],
  ["CB-04", "rol administrador (no es de autoservicio)", registerSchema, { ...coach, role: "ADMINISTRATOR" }, false],
  ["CB-05", "jugador sin código universitario", registerSchema, { ...player, universityCode: undefined }, false],
  ["CB-05", "jugador sin programa", registerSchema, { ...player, program: undefined }, false],
  ["CB-05", "jugador sin semestre", registerSchema, { ...player, semester: undefined }, false],
  ["CB-06", "semestre 0 (bajo el mínimo)", registerSchema, { ...player, semester: 0 }, false],
  ["CB-06", "semestre 1 (en el mínimo)", registerSchema, { ...player, semester: 1 }, true],
  ["CB-06", "semestre 20 (en el máximo)", registerSchema, { ...player, semester: 20 }, true],
  ["CB-06", "semestre 21 (sobre el máximo)", registerSchema, { ...player, semester: 21 }, false],
  ["CB-06", "semestre no entero (3.5)", registerSchema, { ...player, semester: 3.5 }, false],
  // RF13 / RN-10: consent.
  ["CB-07", "acepta la política de datos", registerSchema, coach, true],
  ["CB-07", "no acepta la política de datos", registerSchema, { ...coach, acceptDataPolicy: false }, false],
  ["CB-07", "omite la aceptación", registerSchema, { ...coach, acceptDataPolicy: undefined }, false],
  // RF02: sign in.
  ["CB-08", "credenciales con formato válido", loginSchema, { email: "ana@uni.edu", password: "x" }, true],
  ["CB-08", "contraseña vacía", loginSchema, { email: "ana@uni.edu", password: "" }, false],
  ["CB-08", "correo inválido", loginSchema, { email: "ana", password: "password123" }, false],
  // RF11: reset the password.
  ["CB-09", "nueva contraseña de 8 caracteres", confirmPasswordResetSchema, { token: "t", newPassword: text(8) }, true],
  [
    "CB-09",
    "nueva contraseña de 7 caracteres",
    confirmPasswordResetSchema,
    { token: "t", newPassword: text(7) },
    false,
  ],
  ["CB-09", "sin token", confirmPasswordResetSchema, { token: "", newPassword: text(8) }, false],
  // RF04: create a tournament.
  [
    "CB-10",
    "fin igual al inicio (torneo de un día)",
    createTournamentSchema,
    { ...tournament, endDate: "2026-10-01" },
    true,
  ],
  ["CB-10", "fin después del inicio", createTournamentSchema, tournament, true],
  ["CB-10", "fin antes del inicio", createTournamentSchema, { ...tournament, endDate: "2026-09-30" }, false],
  ["CB-10", "fecha que no es fecha", createTournamentSchema, { ...tournament, startDate: "mañana" }, false],
  ["CB-10", "sin nombre", createTournamentSchema, { ...tournament, name: undefined }, false],
  // RF04 / RN-05 / HU28: configure it.
  ["CB-11", "0 rondas (bajo el mínimo)", configureTournamentSchema, { roundsCount: 0 }, false],
  ["CB-11", "1 ronda (en el mínimo)", configureTournamentSchema, { roundsCount: 1 }, true],
  ["CB-11", "50 rondas (en el máximo)", configureTournamentSchema, { roundsCount: 50 }, true],
  ["CB-11", "51 rondas (sobre el máximo)", configureTournamentSchema, { roundsCount: 51 }, false],
  ["CB-11", "rondas no enteras (2.5)", configureTournamentSchema, { roundsCount: 2.5 }, false],
  ["CB-12", "bye de 0 puntos", configureTournamentSchema, { byePoints: 0 }, true],
  ["CB-12", "bye de medio punto", configureTournamentSchema, { byePoints: 0.5 }, true],
  ["CB-12", "bye de 1 punto", configureTournamentSchema, { byePoints: 1 }, true],
  ["CB-12", "bye de 0.25 (fuera del catálogo)", configureTournamentSchema, { byePoints: 0.25 }, false],
  ["CB-12", "bye de 2 puntos (fuera del catálogo)", configureTournamentSchema, { byePoints: 2 }, false],
  [
    "CB-13",
    "desempates del catálogo, en posiciones distintas",
    configureTournamentSchema,
    {
      tiebreakCriteria: [
        { name: "BUCHHOLZ", order: 1 },
        { name: "SONNEBORN_BERGER", order: 2 },
      ],
    },
    true,
  ],
  [
    "CB-13",
    "desempate fuera del catálogo",
    configureTournamentSchema,
    { tiebreakCriteria: [{ name: "KOYA", order: 1 }] },
    false,
  ],
  [
    "CB-13",
    "el mismo desempate dos veces",
    configureTournamentSchema,
    {
      tiebreakCriteria: [
        { name: "BUCHHOLZ", order: 1 },
        { name: "BUCHHOLZ", order: 2 },
      ],
    },
    false,
  ],
  [
    "CB-13",
    "posición 0 (bajo el mínimo)",
    configureTournamentSchema,
    { tiebreakCriteria: [{ name: "BUCHHOLZ", order: 0 }] },
    false,
  ],
  [
    "CB-13",
    "posición 5 (en el máximo: hay 5 desempates)",
    configureTournamentSchema,
    { tiebreakCriteria: [{ name: "BUCHHOLZ", order: 5 }] },
    true,
  ],
  // RF07 / RN-03: record a result.
  ["CB-14", "resultado 1-0", recordResultSchema, { value: "1-0" }, true],
  ["CB-14", "resultado 0-1", recordResultSchema, { value: "0-1" }, true],
  ["CB-14", "resultado tablas (1/2-1/2)", recordResultSchema, { value: "1/2-1/2" }, true],
  ["CB-14", "incomparecencia de las negras (1F-0F)", recordResultSchema, { value: "1F-0F" }, true],
  ["CB-14", "incomparecencia de las blancas (0F-1F)", recordResultSchema, { value: "0F-1F" }, true],
  ["CB-14", "incomparecencia de ambos (0F-0F)", recordResultSchema, { value: "0F-0F" }, true],
  ["CB-14", "BYE (solo lo asigna el motor)", recordResultSchema, { value: "BYE" }, false],
  ["CB-14", "un valor fuera del catálogo (2-0)", recordResultSchema, { value: "2-0" }, false],
  ["CB-14", "resultado vacío", recordResultSchema, { value: "" }, false],
  // RF07 / HU11: correct it.
  ["CB-15", "corrección sin motivo (es opcional)", correctResultSchema, { value: "0-1" }, true],
  ["CB-15", "corrección con motivo de solo espacios", correctResultSchema, { value: "0-1", reason: "   " }, false],
  ["CB-15", "motivo de 500 caracteres (en el máximo)", correctResultSchema, { value: "0-1", reason: text(500) }, true],
  [
    "CB-15",
    "motivo de 501 caracteres (sobre el máximo)",
    correctResultSchema,
    { value: "0-1", reason: text(501) },
    false,
  ],
  // RF21 / RN-09: manual adjustment.
  ["CB-16", "intercambio sin motivo", swapPlayersSchema, { playerAId: UUID, playerBId: UUID }, false],
  [
    "CB-16",
    "motivo de 2 caracteres (bajo el mínimo)",
    swapPlayersSchema,
    { playerAId: UUID, playerBId: UUID, reason: "ab" },
    false,
  ],
  [
    "CB-16",
    "motivo de 3 caracteres (en el mínimo)",
    swapPlayersSchema,
    { playerAId: UUID, playerBId: UUID, reason: "abc" },
    true,
  ],
  [
    "CB-16",
    "jugador identificado por algo que no es un id",
    swapPlayersSchema,
    { playerAId: "jugador-1", playerBId: UUID, reason: "Mismo club" },
    false,
  ],
  ["CB-17", "ronda normal, sin cuerpo", generateRoundSchema, {}, true],
  [
    "CB-17",
    "revancha autorizada con motivo",
    generateRoundSchema,
    { allowRematches: true, reason: "Pocos jugadores" },
    true,
  ],
  ["CB-17", "revancha autorizada sin motivo", generateRoundSchema, { allowRematches: true }, false],
  // RF12: edit one's own profile.
  ["CB-18", "fecha de nacimiento el 1 de enero de 1900", updateProfileSchema, { birthDate: "1900-01-01" }, true],
  ["CB-18", "fecha de nacimiento en 1899", updateProfileSchema, { birthDate: "1899-12-31" }, false],
  ["CB-18", "fecha de nacimiento futura", updateProfileSchema, { birthDate: "2999-01-01" }, false],
  ["CB-18", "género fuera del catálogo", updateProfileSchema, { gender: "OTRO" }, false],
  ["CB-18", "borrar el género (dato sensible opcional)", updateProfileSchema, { gender: null }, true],
  // RF15: clubs.
  ["CB-19", "club de 2 caracteres", createClubSchema, { name: "AB" }, true],
  ["CB-19", "club de 1 carácter", createClubSchema, { name: "A" }, false],
  // #141: notices.
  ["CB-20", "desactivar el aviso de ronda", notificationSettingsSchema, { roundPublished: false }, true],
  ["CB-20", "un valor que no es sí o no", notificationSettingsSchema, { roundPublished: "si" }, false],
  // Every entity id in a URL or body.
  ["CB-21", "un UUID", idSchema, UUID, true],
  ["CB-21", "un texto que no es UUID", idSchema, "../users", false],
];

describe("black-box cases (plan de pruebas, 8.1.1)", () => {
  it.each(cases)("%s: %s", (_id, _description, schema, input, valid) => {
    expect(schema.safeParse(input).success).toBe(valid);
  });
});
