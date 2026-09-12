<script setup lang="ts">
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
  <div class="page">
    <header class="site-header">
      <div class="container site-header__inner">
        <AppLogo />
        <RouterLink to="/registro" class="btn btn-primary">Crear cuenta</RouterLink>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="hero__glyph" aria-hidden="true">♜</div>
        <div class="container hero__inner">
          <p class="hero__eyebrow">Práctica de Ingeniería IV · Universidad Central</p>
          <h1 class="hero__title">
            Torneos de ajedrez universitarios,<br />
            sin hojas de cálculo
          </h1>
          <p class="hero__subtitle">
            Torre Central Hub automatiza el ciclo completo de un torneo: inscripción, emparejamiento suizo
            adaptado, resultados, clasificación y desempates — en tiempo real y con trazabilidad administrativa
            completa.
          </p>
          <div class="hero__actions">
            <RouterLink to="/registro" class="btn btn-primary">Crear cuenta gratis</RouterLink>
            <a href="#funciona" class="btn btn-ghost">Cómo funciona</a>
          </div>
        </div>
      </section>

      <section id="funciona" class="section">
        <div class="container">
          <h2 class="section__title">Todo el ciclo del torneo, en un solo lugar</h2>
          <p class="section__subtitle">
            Desde la inscripción hasta el cierre oficial, cubriendo las reglas de un torneo suizo real.
          </p>

          <div class="feature-grid">
            <article v-for="feature in FEATURES" :key="feature.title" class="feature-card">
              <span class="feature-card__glyph" aria-hidden="true">{{ feature.glyph }}</span>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.text }}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section section--alt">
        <div class="container">
          <h2 class="section__title">Cuatro pasos, un torneo completo</h2>

          <ol class="steps">
            <li v-for="step in STEPS" :key="step.n" class="step">
              <span class="step__n">{{ step.n }}</span>
              <div>
                <h3>{{ step.title }}</h3>
                <p>{{ step.text }}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section class="section cta">
        <div class="container cta__inner">
          <h2>¿Organizás un torneo?</h2>
          <p>Creá tu cuenta como organizador, árbitro, entrenador o jugador y empezá a usarlo hoy.</p>
          <RouterLink to="/registro" class="btn btn-primary">Crear cuenta</RouterLink>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container site-footer__inner">
        <AppLogo size="md" />
        <p>Universidad Central — Facultad de Ingeniería y Ciencias Básicas</p>
        <a href="https://github.com/hasttyr/torre" target="_blank" rel="noopener">GitHub</a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
  background: rgba(15, 17, 21, 0.75);
  border-bottom: 1px solid var(--border-soft);
}

.site-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-block: 1rem;
}

.hero {
  position: relative;
  overflow: hidden;
  padding-block: clamp(3.5rem, 8vw, 7rem) clamp(3rem, 6vw, 5rem);
  text-align: center;
}

.hero__glyph {
  position: absolute;
  top: -6rem;
  right: -3rem;
  font-size: clamp(16rem, 30vw, 26rem);
  color: rgba(201, 162, 39, 0.06);
  line-height: 1;
  pointer-events: none;
  user-select: none;
}

.hero__inner {
  position: relative;
  max-width: 46rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.hero__eyebrow {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.hero__title {
  font-size: clamp(2.1rem, 5vw, 3.4rem);
}

.hero__subtitle {
  font-size: 1.1rem;
  max-width: 38rem;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.section {
  padding-block: clamp(3rem, 6vw, 5rem);
}

.section--alt {
  background: var(--bg-elevated);
  border-block: 1px solid var(--border-soft);
}

.section__title {
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  text-align: center;
  max-width: 34rem;
  margin-inline: auto;
}

.section__subtitle {
  text-align: center;
  margin: 0.75rem auto 0;
  max-width: 34rem;
}

.feature-grid {
  margin-top: 2.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15.5rem, 1fr));
  gap: 1.25rem;
}

.feature-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease;
}

.feature-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-border);
}

.feature-card__glyph {
  display: inline-flex;
  font-size: 1.6rem;
  color: var(--accent);
  margin-bottom: 0.75rem;
}

.feature-card h3 {
  font-size: 1.05rem;
  margin-bottom: 0.4rem;
}

.feature-card p {
  font-size: 0.92rem;
}

.steps {
  list-style: none;
  margin: 2.5rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 1.5rem;
}

.step {
  display: flex;
  gap: 1rem;
}

.step__n {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--accent);
  flex-shrink: 0;
}

.step h3 {
  font-size: 1rem;
  margin-bottom: 0.3rem;
}

.step p {
  font-size: 0.9rem;
}

.cta__inner {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.cta__inner p {
  max-width: 30rem;
}

.cta__inner .btn {
  margin-top: 0.5rem;
}

.site-footer {
  border-top: 1px solid var(--border-soft);
  padding-block: 2rem;
  margin-top: auto;
}

.site-footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.site-footer__inner a {
  text-decoration: none;
  color: var(--text-muted);
}

.site-footer__inner a:hover {
  color: var(--accent);
}
</style>
