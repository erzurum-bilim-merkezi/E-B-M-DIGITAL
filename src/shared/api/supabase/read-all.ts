import { unwrap } from './errors'

/** Rows per request: the API's max_rows (supabase/config.toml) caps every read at this. */
export const READ_PAGE_SIZE = 1000

/**
 * Reads every row of a query, one page after another, past the API's row cap. `page` builds the
 * query for a range of rows and must order it by a unique key, so pages neither overlap nor skip.
 */
export async function readAll(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += READ_PAGE_SIZE) {
    // oxlint-disable-next-line no-await-in-loop -- each page starts where the previous one ended
    const chunk = unwrap(await page(from, from + READ_PAGE_SIZE - 1)) ?? []
    rows.push(...chunk)
    if (chunk.length < READ_PAGE_SIZE) return rows
  }
}
