// The illustrations of the landing's feature tiles, as one module so they
// load as a single chunk: they sit below the fold, and the landing ships in
// the startup bundle every page downloads (see router/index.ts).
export { default as AuditMock } from "./AuditMock.vue";
export { default as ExportMock } from "./ExportMock.vue";
export { default as PairingsMock } from "./PairingsMock.vue";
export { default as ResultMock } from "./ResultMock.vue";
export { default as RolesMock } from "./RolesMock.vue";
export { default as StandingsMock } from "./StandingsMock.vue";
