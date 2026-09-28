/**
 * A search term for a PostgREST `like` filter on the `*_search` computed columns (kit_search,
 * media_search): folded like toLocaleLowerCase('tr') — as private.tr_lower folds the text — and
 * without the characters of the filter syntax.
 */
export function searchTerm(query: string) {
  return query
    .replace(/[%,()*"\\]/g, ' ')
    .trim()
    .toLocaleLowerCase('tr')
}
