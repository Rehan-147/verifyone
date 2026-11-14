export type ParsedBulkInput = { headers: string[]; records: Array<Record<string, unknown>> };

export function parseRfc4180(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let afterQuote = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') { inQuotes = false; afterQuote = true; }
      else field += char;
      continue;
    }
    if (afterQuote) {
      if (char === ',') { row.push(field); field = ''; afterQuote = false; continue; }
      if (char === '\r' || char === '\n') {
        row.push(field); rows.push(row); row = []; field = ''; afterQuote = false;
        if (char === '\r' && source[i + 1] === '\n') i += 1;
        continue;
      }
      throw new Error('invalid_csv');
    }
    if (char === '"') {
      if (field.length !== 0) throw new Error('invalid_csv');
      inQuotes = true;
    } else if (char === ',') {
      row.push(field); field = '';
    } else if (char === '\r' || char === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      if (char === '\r' && source[i + 1] === '\n') i += 1;
    } else field += char;
  }
  if (inQuotes) throw new Error('invalid_csv');
  if (row.length || field.length || afterQuote) { row.push(field); rows.push(row); }
  return rows.filter((values) => values.some((value) => value.length > 0));
}

export function parseCsvInput(text: string): ParsedBulkInput {
  const rows = parseRfc4180(text);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((header) => header.trim());
  const records = rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  return { headers, records };
}

export function parseJsonRows(rows: unknown): ParsedBulkInput {
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('rows_array_required');
  const headers: string[] = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    for (const header of Object.keys(row)) if (!headers.includes(header)) headers.push(header);
  }
  return { headers, records: rows as Array<Record<string, unknown>> };
}

export function findColumn(headers: string[], names: string[]): string | null {
  const byLower = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  for (const name of names) {
    const found = byLower.get(name);
    if (found !== undefined) return found;
  }
  return null;
}

export function encodeCsvCell(value: unknown): string {
  let text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
