import { defineStore } from "pinia";

import {
  abrirInscripciones,
  cerrarInscripciones,
  configurarTorneo,
  crearTorneo,
  inscribirJugador,
  listarJugadoresInscritos,
  listarMisTorneos,
  listarTorneosDisponibles,
  listarTorneosInscrito,
  obtenerTorneo,
  type ConfigurarTorneoPayload,
  type CrearTorneoPayload,
  type JugadorInscrito,
  type Torneo,
} from "../services/torneos";

interface TorneosState {
  actual: Torneo | null;
  jugadoresInscritos: JugadorInscrito[];
  mios: Torneo[];
  disponibles: Torneo[];
  inscrito: Torneo[];
}

export const useTorneosStore = defineStore("torneos", {
  state: (): TorneosState => ({
    actual: null,
    jugadoresInscritos: [],
    mios: [],
    disponibles: [],
    inscrito: [],
  }),
  actions: {
    async cargarMisTorneos(): Promise<void> {
      this.mios = await listarMisTorneos();
    },

    // HU25 + vista de jugador: se cargan juntos porque comparten la misma
    // pantalla ("Torneos disponibles" y "Mis inscripciones" lado a lado).
    async cargarTorneosJugador(): Promise<void> {
      const [disponibles, inscrito] = await Promise.all([listarTorneosDisponibles(), listarTorneosInscrito()]);
      this.disponibles = disponibles;
      this.inscrito = inscrito;
    },

    async crear(payload: CrearTorneoPayload): Promise<Torneo> {
      const torneo = await crearTorneo(payload);
      this.actual = torneo;
      this.jugadoresInscritos = [];
      return torneo;
    },

    async cargar(id: string): Promise<void> {
      this.actual = await obtenerTorneo(id);
      this.jugadoresInscritos = await listarJugadoresInscritos(id);
    },

    async configurar(id: string, payload: ConfigurarTorneoPayload): Promise<void> {
      this.actual = await configurarTorneo(id, payload);
    },

    async abrirInscripciones(id: string): Promise<void> {
      this.actual = await abrirInscripciones(id);
    },

    async cerrarInscripciones(id: string): Promise<void> {
      this.actual = await cerrarInscripciones(id);
    },

    async inscribirJugador(id: string, jugadorId: string): Promise<void> {
      const jugador = await inscribirJugador(id, jugadorId);
      this.jugadoresInscritos.push(jugador);
    },
  },
});
