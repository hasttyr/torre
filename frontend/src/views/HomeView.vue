<script setup lang="ts">
import AppHeader from "../components/AppHeader.vue";
import AppLogo from "../components/AppLogo.vue";

const FEATURES = [
  {
    glyph: "♖",
    title: "Emparejamiento suizo adaptado",
    text: "Sistema Dutch (FIDE C.04.1–C.04.3), sin repetir enfrentamientos y con bye automático cuando el número de jugadores es impar.",
  },
  {
    glyph: "♕",
    title: "Clasificación en tiempo real",
    text: "Puntaje, Buchholz, Buchholz Cortado, Sonneborn-Berger y ARO recalculados apenas se registra un resultado.",
  },
  {
    glyph: "♔",
    title: "Roles y permisos",
    text: "Organizador, árbitro, jugador, entrenador y administrador: cada uno ve y hace solo lo que le corresponde.",
  },
  {
    glyph: "♘",
    title: "Resultados trazables",
    text: "Todo registro y corrección de resultado queda auditado, con recálculo automático de la tabla.",
  },
  {
    glyph: "♙",
    title: "Exportación en PDF",
    text: "Clasificación y emparejamientos listos para imprimir y publicar en el lugar del torneo.",
  },
  {
    glyph: "♗",
    title: "Bitácora de auditoría",
    text: "Cambios de rol, ajustes de emparejamiento y retiros de jugadores, con usuario, fecha y motivo.",
  },
];

const STEPS = [
  { n: "01", title: "Configurá el torneo", text: "Fechas, formato y orden de desempates, definidos antes de la primera ronda." },
  { n: "02", title: "Abrí inscripciones", text: "Los jugadores se registran; cada uno solo puede inscribirse una vez por torneo." },
  { n: "03", title: "Jugá las rondas", text: "Emparejamiento, resultados y clasificación se publican en tiempo real para todos." },
  { n: "04", title: "Cerrá el torneo", text: "Historial, estadísticas y clasificación final quedan disponibles para consulta." },
];
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main>
      <section class="relative overflow-hidden py-14 text-center sm:py-20 lg:py-28">
        <div
          class="pointer-events-none absolute -top-24 -right-12 text-[16rem] leading-none text-accent/6 select-none sm:text-[20rem] lg:text-[26rem]"
          aria-hidden="true"
        >
          ♜
        </div>
        <div class="container relative flex max-w-3xl flex-col items-center gap-5">
          <p class="text-xs font-semibold tracking-[0.08em] text-accent uppercase sm:text-sm">
            Práctica de Ingeniería IV · Universidad Central
          </p>
          <h1 class="text-[2.1rem] leading-tight sm:text-5xl lg:text-6xl">
            Torneos de ajedrez universitarios,<br class="hidden sm:block" />
            sin hojas de cálculo
          </h1>
          <p class="max-w-xl text-base text-text-muted sm:text-lg">
            Torre Central Hub automatiza el ciclo completo de un torneo: inscripción, emparejamiento suizo
            adaptado, resultados, clasificación y desempates — en tiempo real y con trazabilidad administrativa
            completa.
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-3">
            <RouterLink to="/registro" class="btn btn-primary">Crear cuenta gratis</RouterLink>
            <a href="#funciona" class="btn btn-ghost">Cómo funciona</a>
          </div>
        </div>
      </section>

      <section id="funciona" class="py-12 sm:py-16 lg:py-20">
        <div class="container">
          <h2 class="mx-auto max-w-xl text-center text-[1.6rem] sm:text-3xl lg:text-4xl">
            Todo el ciclo del torneo, en un solo lugar
          </h2>
          <p class="mx-auto mt-3 max-w-xl text-center">
            Desde la inscripción hasta el cierre oficial, cubriendo las reglas de un torneo suizo real.
          </p>

          <div class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <article
              v-for="feature in FEATURES"
              :key="feature.title"
              class="rounded-2xl border border-border-soft bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-accent/40"
            >
              <span class="mb-3 inline-flex text-2xl text-accent" aria-hidden="true">{{ feature.glyph }}</span>
              <h3 class="mb-1.5 text-base">{{ feature.title }}</h3>
              <p class="text-sm">{{ feature.text }}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="border-y border-border-soft bg-bg-elevated py-12 sm:py-16 lg:py-20">
        <div class="container">
          <h2 class="mx-auto max-w-xl text-center text-[1.6rem] sm:text-3xl lg:text-4xl">
            Cuatro pasos, un torneo completo
          </h2>

          <ol class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <li v-for="step in STEPS" :key="step.n" class="flex gap-4">
              <span class="shrink-0 font-display text-2xl text-accent">{{ step.n }}</span>
              <div>
                <h3 class="mb-1 text-base">{{ step.title }}</h3>
                <p class="text-sm">{{ step.text }}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section class="py-12 sm:py-16 lg:py-20">
        <div class="container flex flex-col items-center gap-3 text-center">
          <h2 class="text-[1.6rem] sm:text-3xl">¿Organizás un torneo?</h2>
          <p class="max-w-md">Creá tu cuenta como organizador, árbitro, entrenador o jugador y empezá a usarlo hoy.</p>
          <RouterLink to="/registro" class="btn btn-primary mt-2">Crear cuenta</RouterLink>
        </div>
      </section>
    </main>

    <footer class="mt-auto border-t border-border-soft py-8">
      <div class="container flex flex-wrap items-center justify-between gap-4 text-sm text-text-muted">
        <AppLogo size="md" />
        <p>Universidad Central — Facultad de Ingeniería y Ciencias Básicas</p>
        <a href="https://github.com/hasttyr/torre" target="_blank" rel="noopener" class="text-text-muted no-underline hover:text-accent">
          GitHub
        </a>
      </div>
    </footer>
  </div>
</template>
