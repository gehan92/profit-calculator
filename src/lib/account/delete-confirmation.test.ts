import { describe, expect, it } from "vitest";
import { DELETE_CONFIRMATION_WORD, isDeleteConfirmed } from "./delete-confirmation";

describe("isDeleteConfirmed", () => {
  it("accepts the word, with spaces around it", () => {
    expect(DELETE_CONFIRMATION_WORD).toBe("DELETE");
    expect(isDeleteConfirmed("DELETE")).toBe(true);
    expect(isDeleteConfirmed("  DELETE ")).toBe(true);
  });

  it.each(["", "delete", "Delete", "DELET", "DELETE ME", "DE LETE", "ඉවත් කරන්න"])("refuses %j", (typed) => {
    expect(isDeleteConfirmed(typed)).toBe(false);
  });
});
