#!/usr/bin/env node
// Every test suite of the test plan (docs/plan-de-pruebas.md), from one command:
//
//   npm test                      all of them, in order (about 15 minutes)
//   npm test -- security load     only those suites (or groups, see --list)
//   npm run test:list             what there is, by level and kind
//
// Each suite runs even if an earlier one failed, so one run says everything
// that is wrong. At the end: a summary table, also written to
// reports/resumen-pruebas.md, and exit code 1 if any suite failed.
// Needs what the CI needs: PostgreSQL and backend/.env (docs/runbooks/validar-ci.md).

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sanityBase = process.env.SANITY_BASE ? `=${process.env.SANITY_BASE}` : "";

/**
 * The suites, in the order `npm test` runs them. `level` and `kind` are the
 * plan's classification; `box` is how much of the inside the suite knows.
 * Each step is [project folder, command].
 */
const SUITES = [
  {
    id: "static",
    name: "Análisis estático: lint, tipos, formato y build",
    level: "—",
    kind: "No funcional (mantenibilidad)",
    box: "Blanca",
    steps: [
      ["backend", "npm run lint"],
      ["backend", "npx tsc --noEmit"],
      ["backend", "npm run format:check"],
      ["backend", "npm run build"],
      ["frontend", "npm run lint"],
      ["frontend", "npm run format:check"],
      ["frontend", "npm run build"],
    ],
  },
  {
    id: "unit",
    name: "Unitarias (backend y frontend, con cobertura del frontend)",
    level: "Unitario",
    kind: "Funcional",
    box: "Blanca y negra",
    steps: [
      ["backend", "npm test"],
      ["frontend", "npm run test:coverage"],
    ],
  },
  {
    id: "integration",
    name: "Integración contra PostgreSQL real",
    level: "Integración",
    kind: "Funcional",
    box: "Gris",
    steps: [["backend", "npm run test:integration"]],
  },
  {
    id: "coverage",
    name: "Cobertura del backend (unitarias + integración, con umbrales)",
    level: "Unitario e integración",
    kind: "Funcional",
    box: "Blanca",
    steps: [["backend", "npm run test:coverage"]],
  },
  {
    id: "sanity",
    name: "Cordura: las pruebas de lo que cambió, y el humo",
    level: "Unitario a sistema",
    kind: "Funcional",
    box: "Gris",
    inAll: false, // after a minor change; `npm test` already runs everything
    steps: [
      ["backend", `npx vitest run --changed${sanityBase} --passWithNoTests`],
      ["frontend", `npx vitest run --changed${sanityBase} --passWithNoTests`],
      ["frontend", "npm run test:smoke"],
    ],
  },
  {
    id: "smoke",
    name: "Humo: la aplicación arranca y lo principal responde",
    level: "Sistema",
    kind: "Funcional",
    box: "Negra",
    steps: [["frontend", "npm run test:smoke"]],
  },
  {
    id: "system",
    name: "Sistema / E2E: los flujos completos en el navegador (incluye el ensayo de la UAT)",
    level: "Sistema",
    kind: "Funcional",
    box: "Negra",
    steps: [["frontend", "npm run test:e2e"]],
  },
  {
    id: "acceptance",
    name: "Aceptación alfa: ensayo automático de la UAT (E2E-09)",
    level: "Aceptación",
    kind: "Funcional",
    box: "Negra",
    inAll: false, // part of `system`; the beta (P35) is with real users: docs/entrega/acta-uat-p35.md
    steps: [["frontend", "npm run test:acceptance"]],
  },
  {
    id: "usability",
    name: "Interfaz y usabilidad: WCAG 2.1 AA, teclado, móvil, idiomas, tema oscuro",
    level: "Sistema",
    kind: "Funcional (usabilidad)",
    box: "Negra",
    steps: [["frontend", "npm run test:usability"]],
  },
  {
    id: "security",
    name: "Seguridad: cabeceras, sesión, CSRF, permisos, inyección, XSS, datos personales, dependencias",
    level: "Sistema",
    kind: "No funcional",
    box: "Gris",
    steps: [
      ["frontend", "npm run test:security"],
      ["backend", "npm audit --audit-level=high"],
      ["frontend", "npm audit --audit-level=high"],
    ],
  },
  {
    id: "compat",
    name: "Compatibilidad: Firefox, WebKit (Safari), Android e iPhone",
    level: "Sistema",
    kind: "No funcional",
    box: "Negra",
    steps: [["frontend", "npm run test:compat"]],
  },
  {
    id: "installation",
    name: "Instalación y desinstalación: base vacía, migraciones, bootstrap, redespliegue",
    level: "Sistema",
    kind: "No funcional",
    box: "Gris",
    steps: [["backend", "npm run test:installation"]],
  },
  {
    id: "load",
    name: "Rendimiento — carga: 50 usuarios virtuales, umbrales de latencia",
    level: "Sistema",
    kind: "No funcional",
    box: "Gris",
    steps: [["backend", "npm run test:load"]],
  },
  {
    id: "stress",
    name: "Rendimiento — estrés: de 25 a 800 usuarios, punto de quiebre y recuperación",
    level: "Sistema",
    kind: "No funcional",
    box: "Gris",
    steps: [["backend", "npm run test:stress"]],
  },
  {
    id: "endurance",
    name: "Rendimiento — resistencia: carga sostenida, deriva de latencia y memoria",
    level: "Sistema",
    kind: "No funcional",
    box: "Gris",
    steps: [["backend", "npm run test:endurance"]],
  },
  {
    id: "recovery",
    name: "Recuperación: caída del proceso, corte de la base, API y red intermitentes",
    level: "Sistema",
    kind: "No funcional",
    box: "Gris",
    steps: [
      ["backend", "npm run test:recovery"],
      ["frontend", "npm run test:recovery"],
    ],
  },
];

const GROUPS = {
  all: SUITES.filter((suite) => suite.inAll !== false).map((suite) => suite.id),
  regression: ["unit", "integration", "smoke", "system"],
  functional: ["unit", "integration", "smoke", "system", "usability"],
  nonfunctional: ["security", "compat", "installation", "load", "stress", "endurance", "recovery"],
  performance: ["load", "stress", "endurance"],
};

function list() {
  console.log("Suites (npm test -- <id> …):\n");
  for (const suite of SUITES) {
    const note = suite.inAll === false ? "  [no la corre `npm test` solo]" : "";
    console.log(`  ${suite.id.padEnd(13)} ${suite.name}${note}`);
    console.log(`  ${"".padEnd(13)} nivel: ${suite.level} · ${suite.kind} · caja ${suite.box.toLowerCase()}`);
  }
  console.log("\nGrupos:\n");
  for (const [group, ids] of Object.entries(GROUPS)) console.log(`  ${group.padEnd(13)} ${ids.join(", ")}`);
}

function selection(args) {
  const wanted = args.length ? args : ["all"];
  const ids = new Set();
  for (const name of wanted) {
    if (GROUPS[name]) GROUPS[name].forEach((id) => ids.add(id));
    else if (SUITES.some((suite) => suite.id === name)) ids.add(name);
    else throw new Error(`No hay una suite ni un grupo "${name}". Mira: npm run test:list`);
  }
  return SUITES.filter((suite) => ids.has(suite.id));
}

function runStep([folder, command]) {
  return new Promise((resolve) => {
    console.log(`\n$ (${folder}) ${command}`);
    const child = spawn(command, { cwd: join(ROOT, folder), shell: true, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function duration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) return list();

  const suites = selection(args);
  const results = [];
  const started = Date.now();
  for (const suite of suites) {
    console.log(`\n${"=".repeat(80)}\n▶ ${suite.name}\n${"=".repeat(80)}`);
    const suiteStart = Date.now();
    let failedStep;
    for (const step of suite.steps) {
      if ((await runStep(step)) !== 0) {
        failedStep = `(${step[0]}) ${step[1]}`;
        break;
      }
    }
    results.push({ suite, passed: !failedStep, failedStep, ms: Date.now() - suiteStart });
  }

  const rows = results.map(
    ({ suite, passed, ms }) =>
      `| ${passed ? "✅" : "❌"} | ${suite.id} | ${suite.name} | ${suite.level} | ${suite.kind} | ${suite.box} | ${duration(ms)} |`,
  );
  const failures = results.filter((result) => !result.passed);
  const report = [
    `# Resumen de pruebas`,
    ``,
    `${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })} · ${duration(Date.now() - started)} · ${results.length - failures.length} de ${results.length} suites aprobadas`,
    ``,
    `|    | Suite | Qué prueba | Nivel | Tipo | Caja | Duración |`,
    `| -- | ----- | ---------- | ----- | ---- | ---- | -------- |`,
    ...rows,
    ...(failures.length
      ? [``, `Fallaron:`, ...failures.map(({ suite, failedStep }) => `- ${suite.id}: \`${failedStep}\``)]
      : []),
    ``,
    `Fuera de esta corrida: la aceptación beta (P35) con los actores del torneo (docs/entrega/acta-uat-p35.md).`,
    ``,
  ].join("\n");

  mkdirSync(join(ROOT, "reports"), { recursive: true });
  writeFileSync(join(ROOT, "reports", "resumen-pruebas.md"), report);
  console.log(`\n${"=".repeat(80)}\n${report}`);
  console.log(`(Guardado en reports/resumen-pruebas.md)`);
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
