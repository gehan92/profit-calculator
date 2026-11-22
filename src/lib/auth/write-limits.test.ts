import { describe, expect, it } from "vitest";
import { takeWriteTurn, WRITE_LIMITS } from "./write-limits";

describe("takeWriteTurn (Part F5 spam limits)", () => {
  it("lets a person add, edit or delete up to the limit, then says wait", () => {
    const person = "person-who-types-fast";
    for (let turn = 0; turn < WRITE_LIMITS.entryChange.limit; turn++) {
      expect(takeWriteTurn("entryChange", person)).toBe(true);
    }
    expect(takeWriteTurn("entryChange", person)).toBe(false);
  });

  it("counts each person on their own", () => {
    const busy = "busy-person";
    const calm = "calm-person";
    for (let turn = 0; turn < WRITE_LIMITS.entryChange.limit + 5; turn++) takeWriteTurn("entryChange", busy);

    expect(takeWriteTurn("entryChange", busy)).toBe(false);
    expect(takeWriteTurn("entryChange", calm)).toBe(true);
  });

  it("keeps big sends (offline queue, guest import) apart from single records", () => {
    const person = "person-with-a-queue";
    for (let turn = 0; turn < WRITE_LIMITS.bulkSend.limit; turn++) {
      expect(takeWriteTurn("bulkSend", person)).toBe(true);
    }
    expect(takeWriteTurn("bulkSend", person)).toBe(false);
    // Adding one record by hand still works.
    expect(takeWriteTurn("entryChange", person)).toBe(true);
  });

  it("is generous enough for a busy shop: one record a second all minute", () => {
    expect(WRITE_LIMITS.entryChange.limit / (WRITE_LIMITS.entryChange.windowMs / 1000)).toBeGreaterThanOrEqual(1);
  });
});
