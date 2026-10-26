import { MAX_FILE_BYTES, MAX_ROWS, TEMPLATES, type ImportKind } from "./templates";

export type CsvRow = { line: number; values: Record<string, string> };
export class CsvError extends Error {}

/** RFC 4180 quoting. A template is deliberately a single CSV table, never a guessed workbook. */
export function parseTemplateCsv(kind: ImportKind, source: string): CsvRow[] {
  const input = source.replace(/^\uFEFF/, "");
  if (Buffer.byteLength(input, "utf8") > MAX_FILE_BYTES) throw new CsvError("CSV exceeds the 2 MB limit.");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input)) throw new CsvError("CSV contains unsupported control characters.");
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [], cell = "", quoted = false, closed = false, line = 1, rowLine = 1;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else { cell += c; if (c === "\n") line++; }
    } else if (c === ",") { cells.push(cell); cell = ""; closed = false; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      cells.push(cell); records.push({ line: rowLine, cells });
      cells = []; cell = ""; closed = false; line++; rowLine = line;
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else if (c === '"' || closed) throw new CsvError(`Line ${line}: invalid CSV quoting.`);
    else cell += c;
  }
  if (quoted) throw new CsvError(`Line ${rowLine}: unclosed quoted field.`);
  if (cell !== "" || cells.length) { cells.push(cell); records.push({ line: rowLine, cells }); }
  const header = records.shift();
  const expected = TEMPLATES[kind].columns;
  if (!header || header.cells.length !== expected.length || header.cells.some((value, i) => value !== expected[i])) {
    throw new CsvError(`Incorrect ${kind} header. Expected exactly: ${expected.join(",")}`);
  }
  if (records.length > MAX_ROWS) throw new CsvError("CSV exceeds the 5,000 data-row limit.");
  return records.map(({ line: rowNumber, cells }) => {
    if (cells.length !== expected.length) throw new CsvError(`Line ${rowNumber}: expected ${expected.length} columns; found ${cells.length}.`);
    if (cells.some(cell => cell.length > 10_000)) throw new CsvError(`Line ${rowNumber}: a cell exceeds the 10,000-character limit.`);
    if (cells.every(cell => cell.trim() === "")) throw new CsvError(`Line ${rowNumber}: blank data rows are unsupported; remove the row or supply all required values.`);
    return { line: rowNumber, values: Object.fromEntries(expected.map((name, i) => [name, cells[i]])) };
  });
}

export function rowsToCsv(kind: ImportKind, records: string[][]): string {
  const escape = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return [TEMPLATES[kind].columns, ...records].map(row => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

export function strictDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith("0000-") && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
}

export function decimal(value: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value));
}
