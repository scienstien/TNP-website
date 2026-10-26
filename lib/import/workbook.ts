import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";
import { CsvError, parseTemplateCsv, rowsToCsv } from "./csv";
import { EXAMPLE_MARKER, MAX_FILE_BYTES, MAX_ROWS, PREPARATION_RULES, TEMPLATES, type ImportKind } from "./templates";

/** Bound actual inflated bytes before handing an untrusted ZIP to ExcelJS. */
export function checkWorkbookArchive(buffer: Buffer) {
  if (buffer.length > MAX_FILE_BYTES) throw new CsvError("Workbook exceeds the 2 MB limit.");
  let end = buffer.length - 22;
  for (; end >= Math.max(0, buffer.length - 65557); end--) if (buffer.readUInt32LE(end) === 0x06054b50) break;
  if (end < 0 || end < buffer.length - 65557) throw new CsvError("Invalid XLSX archive.");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16), inflated = 0;
  if (!count || count > 128 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) throw new CsvError("Unsupported or oversized workbook archive.");
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw new CsvError("Invalid XLSX directory.");
    const flags = buffer.readUInt16LE(offset + 8), method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20), rawSize = buffer.readUInt32LE(offset + 24);
    const nameSize = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const filename = buffer.subarray(offset + 46, offset + 46 + nameSize).toString("utf8");
    if (names.has(filename) || filename.includes("..") || /vbaProject|externalLinks|embeddings|activeX/i.test(filename)) throw new CsvError("Duplicate entries, macros, external links and embedded objects are unsupported.");
    names.add(filename);
    if ((flags & 1) || ![0, 8].includes(method) || rawSize > 20_000_000 - inflated || local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) throw new CsvError("Encrypted, oversized or invalid workbook archive.");
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + size > offset || start + size > buffer.length) throw new CsvError("Invalid XLSX entry bounds.");
    let data: Buffer;
    try { data = method === 0 ? buffer.subarray(start, start + size) : inflateRawSync(buffer.subarray(start, start + size), { maxOutputLength: 20_000_000 - inflated }); }
    catch { throw new CsvError("Workbook exceeds the 20 MB expanded limit or contains corrupt data."); }
    inflated += data.length;
    if (data.length !== rawSize || inflated > 20_000_000) throw new CsvError("Invalid or oversized workbook contents.");
    if (filename.endsWith(".xml")) {
      const xml = data.toString("utf8");
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new CsvError("XML entities are unsupported.");
      if (/^xl\/worksheets\//.test(filename)) {
        for (const match of xml.matchAll(/<row\b[^>]*\br=["'](\d+)["']/g)) {
          if (Number(match[1]) > MAX_ROWS + 1) throw new CsvError("Workbook exceeds the 5,000 data-row limit.");
        }
      }
    }
    offset += 46 + nameSize + extra + comment;
  }
  if (!names.has("xl/workbook.xml") || !names.has("[Content_Types].xml")) throw new CsvError("Not an XLSX workbook.");
}

export async function templateWorkbook(kind: ImportKind): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const template = TEMPLATES[kind];
  const sheet = workbook.addWorksheet(kind, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = template.fields.map(field => ({ header: field.name, key: field.name, width: Math.max(20, field.name.length + 3), style: { numFmt: "@" } }));
  sheet.getRow(1).font = { bold: true };
  template.fields.forEach((field, i) => { sheet.getCell(1, i + 1).note = `${field.required ? "Required" : "Optional/conditional"}. ${field.type}. ${field.rule}`; });
  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 30 }, { width: 24 }, { width: 100 }];
  instructions.addRow([template.title]);
  instructions.addRow([template.description]);
  for (const rule of PREPARATION_RULES) instructions.addRow([rule]);
  instructions.addRow([]);
  instructions.addRow(["Column (exact order)", "Required / type", "Rule"]);
  for (const field of template.fields) instructions.addRow([field.name, `${field.required ? "Yes" : "No / conditional"} / ${field.type}`, field.rule]);
  const examples = workbook.addWorksheet("Examples");
  examples.addRow(["FICTIONAL EXAMPLES ONLY — never imported. Do not remove the example marker and upload demonstration data."]);
  examples.addRow(template.columns);
  const values = template.fields.map(field => field.example);
  values[0] = EXAMPLE_MARKER + values[0];
  examples.addRow(values);
  examples.columns.forEach(column => { column.width = 26; column.numFmt = "@"; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function workbookToCsv(kind: ImportKind, buffer: Buffer): Promise<string> {
  checkWorkbookArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new CsvError("Unable to read workbook. Upload an unencrypted .xlsx template."); }
  const allowed = new Set([kind, "Instructions", "Examples"]);
  if (workbook.worksheets.some(sheet => !allowed.has(sheet.name as ImportKind))) throw new CsvError(`Unsupported worksheet. Expected '${kind}' with optional 'Instructions' and 'Examples' only.`);
  const sheet = workbook.getWorksheet(kind);
  if (!sheet) throw new CsvError(`Missing worksheet '${kind}'. Worksheet names are case-sensitive.`);
  if (sheet.state !== "visible") throw new CsvError("The data worksheet must be visible.");
  if (sheet.rowCount > MAX_ROWS + 1) throw new CsvError("Workbook exceeds the 5,000 data-row limit.");
  const template = TEMPLATES[kind];
  if (sheet.columnCount !== template.columns.length) throw new CsvError(`Worksheet '${kind}' must have exactly ${template.columns.length} columns.`);
  const records: string[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.hidden) throw new CsvError(`Row ${r}: hidden rows are unsupported.`);
    const values: string[] = [];
    for (let c = 1; c <= template.columns.length; c++) {
      const cell = row.getCell(c), value = cell.value;
      if (sheet.getColumn(c).hidden || cell.isMerged) throw new CsvError(`Cell ${cell.address}: merged cells and hidden columns are unsupported.`);
      if (value === null || value === undefined) values.push("");
      else if (typeof value === "string") values.push(value);
      else if (typeof value === "number" && Number.isFinite(value) && r > 1 && ["Integer", "Decimal"].includes(template.fields[c - 1].type)) values.push(String(value));
      else throw new CsvError(`Cell ${cell.address}: use literal ${template.fields[c - 1].type.toLowerCase()} values. Formulas, dates stored as Excel serials, hyperlinks and other cell objects are unsupported; enter dates as text YYYY-MM-DD.`);
    }
    if (r === 1) {
      if (values.some((value, i) => value !== template.columns[i])) throw new CsvError(`Incorrect ${kind} header. Expected exactly: ${template.columns.join(",")}`);
    } else records.push(values);
  }
  const csv = rowsToCsv(kind, records);
  parseTemplateCsv(kind, csv);
  return csv;
}

export async function readImportFile(kind: ImportKind, file: File): Promise<{ csv: string; bytes: Buffer }> {
  if (file.size > MAX_FILE_BYTES) throw new CsvError("Upload a file of at most 2 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (/\.xlsx$/i.test(file.name)) return { csv: await workbookToCsv(kind, bytes), bytes };
  if (!/\.csv$/i.test(file.name)) throw new CsvError("Upload a .csv or .xlsx template. Legacy .xls and macro-enabled workbooks are unsupported.");
  let csv: string;
  try { csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new CsvError("CSV must use UTF-8 encoding. Save as CSV UTF-8 in Excel."); }
  return { csv, bytes };
}
