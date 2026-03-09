/**
 * Convert an array of rows into CSV format.
 * @param headers Column header names
 * @param rows Array of row arrays (each row is an array of cell values)
 * @returns CSV string
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const escape = (val: unknown): string => {
    const str = val === null || val === undefined ? '' : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\n');
}
