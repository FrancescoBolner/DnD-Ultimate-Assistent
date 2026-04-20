/**
 * Dynamic query builder helpers to eliminate boilerplate
 * in service update functions.
 */

/**
 * Given an object of field→value pairs, builds:
 *  - A SET clause string: "field1 = ?, field2 = ?"
 *  - An array of parameter values
 *
 * Undefined values are skipped. Explicit null is kept.
 *
 * @param data    Object with column names → values
 * @param jsonCols  Column names that should be JSON.stringify'd
 * @returns { setClause, values } or null if nothing to update
 */
export function buildUpdateFields(
  data: Record<string, unknown>,
  jsonCols: string[] = [],
): { setClause: string; values: unknown[] } | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    // Escape reserved words
    const col = key === 'range' ? '`range`' : key;
    fields.push(`${col} = ?`);

    if (jsonCols.includes(key) && value !== null) {
      values.push(JSON.stringify(value));
    } else {
      values.push(value ?? null);
    }
  }

  if (fields.length === 0) return null;

  return {
    setClause: fields.join(', '),
    values,
  };
}
