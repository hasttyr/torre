import { api } from "./api";

export interface CriterioDesempate {
  nombre: string;
  orden: number;
}

export interface Torneo {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: "CREADO" | "INSCRIPCIONES_ABIERTAS" | "INSCRIPCIONES_CERRADAS" | "EN_CURSO" | "FINALIZADO";
  formato: string;
  numeroRondas: number | null;
  ritmo: string | null;
  organizadorId: string;
  criteriosDesempate: CriterioDesempate[];
  createdAt: string;
}

export interface CrearTorneoPayload {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  formato?: string;
}

export interface ConfigurarTorneoPayload {
  numeroRondas?: number;
  ritmo?: string;
  criteriosDesempate?: CriterioDesempate[];
}

export interface JugadorInscrito {
  jugadorId: string;
  nombre: string;
  codigoUniversitario: string;
  programa: string;
  semestre: number;
  inscritoEn: string;
}

export async function listarMisTorneos(): Promise<Torneo[]> {
  const { data } = await api.get<Torneo[]>("/torneos/mios");
  return data;
}

export async function listarTorneosDisponibles(): Promise<Torneo[]> {
  const { data } = await api.get<Torneo[]>("/torneos/disponibles");
  return data;
}

export async function listarTorneosInscrito(): Promise<Torneo[]> {
  const { data } = await api.get<Torneo[]>("/torneos/inscrito");
  return data;
}

export async function crearTorneo(payload: CrearTorneoPayload): Promise<Torneo> {
  const { data } = await api.post<Torneo>("/torneos", payload);
  return data;
}

export async function obtenerTorneo(id: string): Promise<Torneo> {
  const { data } = await api.get<Torneo>(`/torneos/${id}`);
  return data;
}

export async function configurarTorneo(id: string, payload: ConfigurarTorneoPayload): Promise<Torneo> {
  const { data } = await api.put<Torneo>(`/torneos/${id}/configuracion`, payload);
  return data;
}

export async function abrirInscripciones(id: string): Promise<Torneo> {
  const { data } = await api.post<Torneo>(`/torneos/${id}/inscripciones/abrir`);
  return data;
}

export async function cerrarInscripciones(id: string): Promise<Torneo> {
  const { data } = await api.post<Torneo>(`/torneos/${id}/inscripciones/cerrar`);
  return data;
}

export async function inscribirJugador(torneoId: string, jugadorId: string): Promise<JugadorInscrito> {
  const { data } = await api.post<JugadorInscrito>(`/torneos/${torneoId}/jugadores`, { jugadorId });
  return data;
}

export async function listarJugadoresInscritos(torneoId: string): Promise<JugadorInscrito[]> {
  const { data } = await api.get<JugadorInscrito[]>(`/torneos/${torneoId}/jugadores`);
  return data;
}
