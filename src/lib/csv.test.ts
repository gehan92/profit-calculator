import { describe, expect, it } from "vitest";
import { CsvDocument } from "./csv";

const body = (document: CsvDocument) => document.toString().replace("﻿", "");

describe("CsvDocument", () => {
  it("starts with a byte-order mark (Excel reads Sinhala and Tamil) and ends each row with CRLF", () => {
    const csv = new CsvDocument().addRow(["a", "b"]).addRow(["c", "d"]).toString();
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿a,b\r\nc,d\r\n");
  });

  it("wraps cells with a comma, quote or line break in quotes and doubles inner quotes", () => {
    const csv = new CsvDocument().addRow(["rice, 5 kg", 'he said "hi"', "two\nlines", "plain"]);
    expect(body(csv)).toBe('"rice, 5 kg","he said ""hi""","two\nlines",plain\r\n');
  });

  it.each(["=1+1", "+94771234567", "-5", "@SUM(A1)", "\t=cmd", '=HYPERLINK("http://evil","click")'])(
    "defuses a note that a spreadsheet would run as a formula: %j",
    (note) => {
      const line = body(new CsvDocument().addRow([note])).trimEnd();
      expect(line.replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("writes numbers as they are, never with the formula guard (a minus is a real sign)", () => {
    const csv = new CsvDocument().addRow([CsvDocument.number("-12.50"), CsvDocument.number("1500.00")]);
    expect(body(csv)).toBe("-12.50,1500.00\r\n");
  });

  it("keeps Sinhala and Tamil text untouched", () => {
    expect(body(new CsvDocument().addRow(["තොග", "சரக்கு"]))).toBe("තොග,சரக்கு\r\n");
  });

  it("counts rows", () => {
    expect(new CsvDocument().addRow(["a"]).addRow(["b"]).rowCount).toBe(2);
  });
});
