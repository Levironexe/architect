// architect-ignore-file
// Pre-config-module code; reads env directly on purpose until the migration lands.
export const legacyKey = process.env.LEGACY_KEY ?? '';
