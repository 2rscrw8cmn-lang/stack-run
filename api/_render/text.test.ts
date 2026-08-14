import { describe, expect, it } from "vitest";
import {
  CARD_FONT,
  drawableText,
  fitTextSize,
  measureText,
  textPolygons,
  truncateText,
  wrapText,
} from "./text.js";

describe("Card text", () => {
  it("carries the glyphs a crew name needs", () => {
    expect(CARD_FONT.unitsPerEm).toBeGreaterThan(0);
    for (const character of "ABCXYZabcxyz0189 ·-'&é") {
      expect(CARD_FONT.glyphs[character.codePointAt(0)!]).toBeDefined();
    }
  });

  it("measures a monospaced line by its advances", () => {
    const single = measureText("A", { size: 100 });
    expect(measureText("ABCD", { size: 100 })).toBeCloseTo(single * 4, 5);
    expect(measureText("", { size: 100 })).toBe(0);
  });

  it("counts letter spacing between characters but not after the last", () => {
    expect(measureText("AB", { size: 100, tracking: 10 })).toBeCloseTo(
      measureText("AB", { size: 100 }) + 10,
      5,
    );
  });

  it("keeps a character the font can draw", () => {
    expect(drawableText("Café Crew")).toBe("Café Crew");
  });

  it("falls back to the base letter of a character it cannot draw", () => {
    // Latin Extended-A is outside the subset the app serves the browser, so
    // its accented letters come back as the letters underneath them.
    // "ó" is in that subset and stays; "ł" has no base letter and is dropped.
    expect(drawableText("Ōtaki źółw")).toBe("Otaki zów");
  });

  it("drops a character with no Latin base at all", () => {
    expect(drawableText("東京 Run Club")).toBe(" Run Club");
  });

  it("turns a line into outlines, and blank text into nothing", () => {
    expect(textPolygons("A", 0, 100, { size: 80 }).length).toBeGreaterThan(0);
    expect(textPolygons("   ", 0, 100, { size: 80 })).toEqual([]);
  });

  it("draws each glyph the right way up, above the baseline", () => {
    const polygons = textPolygons("H", 0, 100, { size: 100 });
    const ys = polygons.flat().map((point) => point.y);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100.5);
    expect(Math.min(...ys)).toBeLessThan(60);
  });

  it("shrinks a name until it fits, but not past the floor", () => {
    const name = "Brick By Brick";
    const size = fitTextSize(name, 600, 78, 46);
    expect(size).toBeLessThan(78);
    expect(measureText(name, { size })).toBeLessThanOrEqual(600);
    // Past the floor it stops shrinking; wrapping takes over from there.
    expect(fitTextSize("Saturday Morning Long Run Society", 600, 78, 46)).toBe(46);
    expect(fitTextSize("OUC Half", 600, 78, 46)).toBe(78);
  });

  it("truncates to the width it was given, with an ellipsis" , () => {
    const truncated = truncateText("Chicago Marathon presented by a very long sponsor", 300, {
      size: 30,
    });
    expect(truncated.endsWith("…")).toBe(true);
    expect(measureText(truncated, { size: 30 })).toBeLessThanOrEqual(300);
  });

  it("leaves text that already fits exactly as it is", () => {
    expect(truncateText("OUC Half", 600, { size: 30 })).toBe("OUC Half");
  });

  it("wraps onto a second line at a word boundary", () => {
    const lines = wrapText("Brick By Brick Marathon Crew", 340, { size: 60 }, 2);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(measureText(line, { size: 60 })).toBeLessThanOrEqual(340);
    expect(lines.join(" ").startsWith("Brick By Brick")).toBe(true);
  });

  it("marks the last line when the name runs past the lines allowed", () => {
    const lines = wrapText("One Two Three Four Five Six Seven Eight", 200, { size: 60 }, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("never drops a single word too long to fit", () => {
    const lines = wrapText("Antidisestablishmentarianism", 200, { size: 60 }, 2);
    expect(lines[0].startsWith("Anti")).toBe(true);
  });
});
