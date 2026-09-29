import type {
  DataRequestType as ApiDataRequestType,
  DataRightResult as DataRightResultDto,
  PersonalDataExport as PersonalDataExportDto,
} from "@contracts";

import type { Serialized } from "../lib/serialized";
import { api } from "./api";

// HU22, Ley 1581: the two rights the privacy panel exercises. RECTIFICATION has
// its own flow ("Editar perfil", HU20).
export type DataRequestType = Extract<ApiDataRequestType, "ACCESS" | "SUPPRESSION">;
export type DataRightResult = Serialized<DataRightResultDto>;
/** Everything the system holds about the person (Ley 1581 art. 8). */
export type PersonalDataExport = Serialized<PersonalDataExportDto>;
export type DataAccessResult = DataRightResult & { data: PersonalDataExport };

/** Exercises the "access" right: returns everything held about the titular (HU22). */
export async function requestDataAccess(): Promise<DataAccessResult> {
  const { data } = await api.post<DataAccessResult>("/users/me/data-requests", { type: "ACCESS" });
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
  const { data } = await api.post<DataRightResult>("/users/me/data-requests", { type: "SUPPRESSION", reason });
  return data;
}
