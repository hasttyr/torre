import { api } from "./api";

export interface JugadorBusqueda {
  id: string;
  nombre: string;
  email: string;
  codigoUniversitario: string;
  programa: string;
  semestre: number;
}

export async function buscarJugadores(query: string): Promise<JugadorBusqueda[]> {
  const { data } = await api.get<JugadorBusqueda[]>("/jugadores", { params: { q: query } });
  return data;
}
