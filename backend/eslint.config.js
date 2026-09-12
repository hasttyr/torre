const tseslint = require("typescript-eslint");

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
);
