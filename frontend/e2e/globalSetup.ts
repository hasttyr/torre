import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Before the run: the E2E database, migrated, emptied and seeded (backend: npm run e2e:prepare). */
export default function globalSetup(): void {
  execSync("npm run e2e:prepare", { cwd: fileURLToPath(new URL("../../backend", import.meta.url)), stdio: "inherit" });
}
