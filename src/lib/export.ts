/**
 * Tabular exports.
 *
 * CSV opens in Excel, Google Sheets and LibreOffice alike, so it is the one
 * format worth generating by hand; anything that needs a real .xlsx should be
 * converted from this rather than assembled twice.
 */

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

/**
 * Escapes one CSV cell.
 *
 * Two hazards, both real: a value containing a comma, quote or newline breaks
 * the row unless quoted; and a value starting with =, +, - or @ is executed as
 * a formula when the file is opened in a spreadsheet, which is how a product
 * name becomes a phishing link. Prefixing an apostrophe defuses it.
 */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv<T>(rows: T[], columns: Array<ExportColumn<T>>): string {
  const header = columns.map((column) => escapeCell(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(","));
  // A BOM so Excel on Windows reads Bangla text as UTF-8 rather than mojibake.
  return `﻿${[header, ...body].join("\r\n")}\r\n`;
}

/** Filename-safe slug with the date baked in, e.g. `inventory-2026-08-27.csv`. */
export function exportFilename(prefix: string, extension = "csv"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.${extension}`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
