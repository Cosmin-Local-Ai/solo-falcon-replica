export * from './rules';
export * from './package2026';
export * from './release2026';
// B-112 — the FY2026 DPI revision, exported beside the release it supersedes so the barrel answers
// "what does this build carry?" in one place. Production call sites still go through `selectRuleSet`.
export * from './release2026dpi';
export * from './calculators';
// TASK 6: the content address and the registry are part of the public surface of this directory on
// purpose. `selectRuleSet` is the only way a consumer should obtain a rule set; the year-named constants
// above stay exported for the tests and the registry seed, and every production call site now goes
// through the selector.
export * from './ruleSetDigest';
export * from './registry';
