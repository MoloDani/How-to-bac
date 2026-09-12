export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Rows were fetched with `take: limit + 1`; the extra one only signals another page. */
export const toPage = <Row extends { id: string }, T>(
  rows: Row[],
  limit: number,
  map: (row: Row) => T,
): Page<T> => {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(map),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
};
