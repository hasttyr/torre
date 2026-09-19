const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Convención del proyecto: un parámetro prefijado con "_" (p. ej. el
      // "_next" que Express exige por firma en middlewares de error) es
      // intencionalmente no usado.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // Debe ir al final: apaga cualquier regla de estilo que choque con
  // Prettier (el formato es responsabilidad de Prettier, no de ESLint).
  eslintConfigPrettier,
);
