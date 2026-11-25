import { describe, expect, it } from "vitest";
import { afterSync, budget, clock, duration, fill, freeSlot, nextFree, original, snap } from "../src/modules/chronos-runway/day";

describe("chronos runway maths", () => {
  it("reads 5h 39m usable time", () => expect(duration(budget(original).workable)).toBe("5h 39m"));
  it("original plan keeps a 2h stretch", () => {
    const b = budget(original);
    expect(duration(b.longest)).toBe("2h 00m");
    expect(duration(b.unassigned)).toBe("2h 59m");
  });
  it("after launch sync: shorter stretch, same total", () => {
    const b = budget(afterSync);
    expect(duration(b.longest)).toBe("1h 10m");
    expect(duration(b.unassigned)).toBe("2h 59m");
  });
  it("refuses occupied and out-of-day slots", () => {
    expect(freeSlot(original)).toBe(true);
    expect(freeSlot(930)).toBe(false);
    expect(freeSlot(0)).toBe(false);
  });
  it("walks to the next free slot and snaps to 5 minutes", () => {
    expect(nextFree(original, -1)).toBe(original - 5);
    expect(nextFree(original, 1)).toBe(960);
    expect(nextFree(0, -1)).toBeNull();
    expect(snap(823)).toBe(825);
    expect(clock(snap(5000))).toBe("17:50");
  });
  it("fills tokens", () => expect(fill("at {time} {x}", { time: "10:21" })).toBe("at 10:21 {x}"));
});
