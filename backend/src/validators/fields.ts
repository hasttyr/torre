import { z } from "zod";

// The fields many request schemas share, each with one size limit (B-D3):
// nothing a client sends is stored, rendered in PDFs or shown in the UI
// without a bound.

export const MAX_LENGTH = {
  name: 100,
  email: 254, // RFC 5321's limit for an address
  password: 128,
  universityCode: 30,
  program: 100,
  reason: 500,
} as const;

/** The message for a text over its limit. */
export const tooLong = (max: number): string => `No puede superar ${max} caracteres`;

/** An entity id: every primary key is a UUID, in the shape PostgreSQL stores (any version). */
export const idSchema = z.guid("El identificador no es válido");

/** A person's, club's or tournament's name. */
export const nameSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(MAX_LENGTH.name, tooLong(MAX_LENGTH.name));

export const emailSchema = z
  .string()
  .trim()
  .max(MAX_LENGTH.email, tooLong(MAX_LENGTH.email))
  .email("El correo no es válido");

/** A password being chosen (registration, reset). */
export const newPasswordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(MAX_LENGTH.password, tooLong(MAX_LENGTH.password));

export const universityCodeSchema = z
  .string()
  .trim()
  .min(1, "El código universitario es requerido")
  .max(MAX_LENGTH.universityCode, tooLong(MAX_LENGTH.universityCode));

export const programSchema = z
  .string()
  .trim()
  .min(1, "El programa es requerido")
  .max(MAX_LENGTH.program, tooLong(MAX_LENGTH.program));

/** Why someone did something (a withdrawal, a correction, a request). */
export const reasonSchema = z
  .string()
  .trim()
  .min(1, "El motivo no puede quedar vacío")
  .max(MAX_LENGTH.reason, tooLong(MAX_LENGTH.reason));
