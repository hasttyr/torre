import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadLocalEnvFile, readEnvFile } from "./localEnvFile";

const dir = mkdtempSync(join(tmpdir(), "torre-env-"));
const file = join(dir, ".env");

describe("loadLocalEnvFile", () => {
  afterEach(() => {
    delete process.env.TORRE_TEST_ONLY_FILE;
    delete process.env.TORRE_TEST_BOTH;
    rmSync(file, { force: true });
  });

  it("loads a development .env, without overriding what the environment already sets", () => {
    writeFileSync(file, "TORRE_TEST_ONLY_FILE=from-file\nTORRE_TEST_BOTH=from-file\n");
    process.env.TORRE_TEST_BOTH = "from-environment";

    loadLocalEnvFile(file);

    expect(process.env.TORRE_TEST_ONLY_FILE).toBe("from-file");
    expect(process.env.TORRE_TEST_BOTH).toBe("from-environment");
  });

  it("does nothing where there is no .env, as on a deploy that sets real variables", () => {
    expect(() => loadLocalEnvFile(join(dir, "missing.env"))).not.toThrow();
  });
});

describe("readEnvFile", () => {
  it("reads a .env's variables without loading them into the process", () => {
    writeFileSync(file, 'DATABASE_URL="postgresql://u:p@localhost/torre"\n');

    expect(readEnvFile(file)).toEqual({ DATABASE_URL: "postgresql://u:p@localhost/torre" });
    expect(process.env.DATABASE_URL).not.toBe("postgresql://u:p@localhost/torre");
  });

  it("reads nothing where there is no .env", () => {
    expect(readEnvFile(join(dir, "missing.env"))).toEqual({});
  });
});
