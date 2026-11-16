import { describe, expect, it } from "vitest";
import { f, fieldsToZod, fitStep, mediaRefs, noImage, publishProblems, t, withDefaults } from "../src/core/fields";

describe("text fit (05-text-and-image-spec §1)", () => {
  const h = f.heading("H", { max: 60, maxLines: 2, fit: 30 });
  it("fits, shrinks one step, two steps, then is too long", () => {
    expect(fitStep("a".repeat(30), h)).toBe(0);
    expect(fitStep("a".repeat(35), h)).toBe(1);
    expect(fitStep("a".repeat(43), h)).toBe(2);
    expect(fitStep("a".repeat(44), h)).toBe("over");
    expect(fitStep("a".repeat(61), h)).toBe("over");
  });
  it("pills and buttons never shrink or wrap", () => {
    const p = f.pill("P", 10);
    expect(fitStep("a".repeat(10), p)).toBe(0);
    expect(fitStep("a".repeat(11), p)).toBe("over");
  });
});

describe("schemas", () => {
  const fields = { title: f.heading("T", { max: 10, maxLines: 1 }), img: f.image("I", "1 / 1", ["fill"], "x"), items: f.list("L", "i", { name: f.pill("n") }, 0, 2) };
  const schema = fieldsToZod(fields);
  it("accepts good content", () => {
    expect(schema.safeParse({ title: t("Hi"), img: noImage(), items: [{ name: t("a") }] }).success).toBe(true);
  });
  it("rejects lists over max and bad shapes", () => {
    expect(schema.safeParse({ title: t("Hi"), img: noImage(), items: [{ name: t("a") }, { name: t("b") }, { name: t("c") }] }).success).toBe(false);
    expect(schema.safeParse({ title: "Hi", img: noImage(), items: [] }).success).toBe(false);
  });
  it("blocks publish for too-long text and images without alt", () => {
    const c = { title: t("x".repeat(20)), img: { ...noImage(), mediaId: "m1", key: "m/1" }, items: [] };
    const p = publishProblems(fields, c);
    expect(p.map((x) => x.path)).toEqual(["title", "img"]);
    expect(mediaRefs(fields, c)).toEqual([{ mediaId: "m1", path: "img" }]);
  });
  it("withDefaults fills new fields without touching existing values", () => {
    expect(withDefaults({ a: t("A"), b: 1 }, { a: t("Z") })).toEqual({ a: t("Z"), b: 1 });
  });
});
