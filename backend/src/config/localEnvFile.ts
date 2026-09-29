import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// Development keeps its settings in a local .env (see .env.example); a
// deploy sets real environment variables and has no file. Node reads the
// file itself: no dotenv dependency.

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** Loads a local .env into process.env, if there is one. Variables the environment already sets win. */
export function loadLocalEnvFile(path = ".env"): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}

/** A local .env's variables, without loading them into the process ({} if there's no file). */
export function readEnvFile(path = ".env"): Record<string, string> {
  try {
    return parseEnv(readFileSync(path, "utf8")) as Record<string, string>;
  } catch (error) {
    if (isMissingFile(error)) return {};
    throw error;
  }
}
