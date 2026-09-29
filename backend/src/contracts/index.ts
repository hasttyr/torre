// The API contract: the catalogs, error codes and response bodies both
// sides of the API compile against. The frontend imports this module
// (as @contracts), so everything here must stay free of dependencies: no
// Prisma, no zod, no Node, nothing outside this folder.
export * from "./catalogs";
export * from "./errors";
export type * from "./responses";
