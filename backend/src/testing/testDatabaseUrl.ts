// Which databases the test suites may use. Kept apart from testDatabase.ts,
// and free of app imports, so a suite's setup can point DATABASE_URL at its
// database before config/env.ts reads the environment (once, when first
// imported).

export const TEST_SUFFIX = "_test";

type Env = Record<string, string | undefined>;

/**
 * `explicit` as given, or else DATABASE_URL's database with `suffix` appended.
 *
 * @throws {Error} unless the database's name ends in "_test": the suites
 * empty every table, and must never be pointed at real data.
 */
function suiteDatabaseUrl(env: Env, explicit: string, suffix: string): string {
  const given = env[explicit];
  const source = given ?? env.DATABASE_URL;
  if (!source) {
    throw new Error(`Set ${explicit} (or DATABASE_URL, whose database gets a ${suffix} suffix) to run this suite`);
  }
  const url = new URL(source);
  if (!given) url.pathname = `${url.pathname}${suffix}`;
  if (!url.pathname.endsWith(TEST_SUFFIX)) {
    throw new Error(`Refusing to run tests against "${url.pathname.slice(1)}": its name must end in _test`);
  }
  return url.toString();
}

/**
 * The integration suite's database: TEST_DATABASE_URL, or else
 * DATABASE_URL's database with a "_test" suffix (torre_central_hub →
 * torre_central_hub_test).
 */
export function resolveTestDatabaseUrl(env: Env = process.env): string {
  return suiteDatabaseUrl(env, "TEST_DATABASE_URL", TEST_SUFFIX);
}

/**
 * The browser (E2E) suite's database, apart from the integration suite's:
 * E2E_DATABASE_URL, or else DATABASE_URL's database with an "_e2e_test"
 * suffix (torre_central_hub → torre_central_hub_e2e_test).
 */
export function resolveE2eDatabaseUrl(env: Env = process.env): string {
  return suiteDatabaseUrl(env, "E2E_DATABASE_URL", `_e2e${TEST_SUFFIX}`);
}
