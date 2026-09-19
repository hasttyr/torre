import { api } from "./api";
import type { RegisteredUser } from "./auth";

// HU22/Ley 1581 de 2012: derechos ARCO ejercidos por el titular. RECTIFICACION
// no está expuesta acá porque ya tiene su propio flujo dedicado (HU20, "Editar
// perfil"); estos dos son los que no tienen otra UI todavía.
export type DataRequestType = "ACCESO" | "SUPRESION";

export interface DataRightResult {
  type: DataRequestType;
  status: "RESUELTA" | "BLOQUEADA";
  message: string;
  user: RegisteredUser;
}

/** Exercises the "access" right: returns the titular's own data (HU22). */
export async function requestDataAccess(): Promise<DataRightResult> {
  const { data } = await api.post<DataRightResult>("/users/me/data-requests", { type: "ACCESO" });
  return data;
}

/**
 * Exercises the "suppression" right (HU22).
 *
 * @remarks
 * If the account has data indispensable to a tournament in progress, the
 * backend blocks it instead of deleting it (CA HU22); either way, the
 * account is deactivated and the current session should be closed after
 * this resolves.
 */
export async function requestDataSuppression(reason?: string): Promise<DataRightResult> {
  const { data } = await api.post<DataRightResult>("/users/me/data-requests", { type: "SUPRESION", reason });
  return data;
}
