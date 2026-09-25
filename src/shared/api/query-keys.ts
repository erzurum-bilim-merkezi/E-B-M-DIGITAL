/**
 * Query key roots. Every Studio query key starts with `studio` and every Kâşif key with `kids`,
 * so a mutation in one Studio feature can refresh the others without importing their key
 * factories (features stay independent — ADR 0003).
 */
export const STUDIO_QUERY_ROOT = 'studio'
export const KIDS_QUERY_ROOT = 'kids'
