/**
 * Builds a CSV file that opens correctly in Excel and Google Sheets
 * (Part D2 Settings "export CSV").
 *
 * - Cells with a comma, quote or line break are wrapped in quotes, and a
 *   quote inside a cell is doubled (RFC 4180).
 * - Text that starts with = + - @ (or a tab / carriage return) would be run as
 *   a formula by a spreadsheet ("CSV injection": a note typed as
 *   `=HYPERLINK(...)`), so a ' is put in front of it. Numbers are written as
 *   numbers by the caller (`CsvDocument.number`) and never get this guard.
 * - A byte-order mark at the start makes Excel read Sinhala and Tamil letters
 *   correctly.
 */

/** A cell written as a number (see `CsvDocument.number`). */
export interface CsvNumber {
  csvNumber: string;
}

export class CsvDocument {
  private static readonly BYTE_ORDER_MARK = "﻿";
  private static readonly LINE_BREAK = "\r\n";
  private static readonly FORMULA_START = /^[=+\-@\t\r]/;

  private readonly rows: string[] = [];

  /** Adds one row of text cells and number cells. */
  addRow(cells: readonly (string | CsvNumber)[]): this {
    this.rows.push(cells.map((cell) => CsvDocument.escape(cell)).join(","));
    return this;
  }

  /** A cell that is a number, e.g. "1500.50": written as it is, without the formula guard. */
  static number(text: string): CsvNumber {
    return { csvNumber: text };
  }

  get rowCount(): number {
    return this.rows.length;
  }

  toString(): string {
    return CsvDocument.BYTE_ORDER_MARK + this.rows.join(CsvDocument.LINE_BREAK) + CsvDocument.LINE_BREAK;
  }

  private static escape(cell: string | CsvNumber): string {
    if (typeof cell !== "string") return cell.csvNumber;

    const safe = CsvDocument.FORMULA_START.test(cell) ? `'${cell}` : cell;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  }
}
