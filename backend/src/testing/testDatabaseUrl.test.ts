import { describe, expect, it } from "vitest";

import { resolveE2eDatabaseUrl, resolveTestDatabaseUrl } from "./testDatabaseUrl";

describe("resolveTestDatabaseUrl", () => {
  it("derives the test database from DATABASE_URL, so the dev data is never the one truncated", () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL: "postgresql://u:p@localhost:5432/torre?schema=public" })).toBe(
      "postgresql://u:p@localhost:5432/torre_test?schema=public",
    );
  });

  it("uses TEST_DATABASE_URL as given when it names a _test database", () => {
    const url = "postgresql://u:p@db:5432/ci_test";

    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: url, DATABASE_URL: "postgresql://u:p@db/prod" })).toBe(url);
  });

  it("refuses a TEST_DATABASE_URL whose database doesn't end in _test", () => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://u:p@db:5432/torre" })).toThrow(/_test/);
  });
});

describe("resolveE2eDatabaseUrl", () => {
  it("gives the browser suite a database of its own, apart from the integration suite's", () => {
    expect(resolveE2eDatabaseUrl({ DATABASE_URL: "postgresql://u:p@localhost:5432/torre" })).toBe(
      "postgresql://u:p@localhost:5432/torre_e2e_test",
    );
  });

  it("uses E2E_DATABASE_URL as given, and refuses one whose database doesn't end in _test", () => {
    const url = "postgresql://u:p@db:5432/browser_test";

    expect(resolveE2eDatabaseUrl({ E2E_DATABASE_URL: url })).toBe(url);
    expect(() => resolveE2eDatabaseUrl({ E2E_DATABASE_URL: "postgresql://u:p@db:5432/torre" })).toThrow(/_test/);
  });
});
