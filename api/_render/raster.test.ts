import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createCanvas, fillPolygons, paint, parseColor } from "./canvas.js";
import { pathPolygons, rectPolygon } from "./geometry.js";
import { encodePng } from "./png.js";

const BLACK = parseColor("#000000");

function pixel(canvas: ReturnType<typeof createCanvas>, x: number, y: number) {
  const at = (y * canvas.width + x) * 3;
  return [canvas.data[at], canvas.data[at + 1], canvas.data[at + 2]].map(Math.round);
}

describe("Filling", () => {
  it("paints inside a shape and leaves the outside alone", () => {
    const canvas = createCanvas(20, 20, BLACK);
    fillPolygons(canvas, [rectPolygon(5, 5, 10, 10)], { color: "#ffffff" });
    expect(pixel(canvas, 10, 10)).toEqual([255, 255, 255]);
    expect(pixel(canvas, 2, 2)).toEqual([0, 0, 0]);
  });

  it("softens an edge that falls between pixels", () => {
    const canvas = createCanvas(20, 20, BLACK);
    fillPolygons(canvas, [rectPolygon(5.5, 0, 10, 20)], { color: "#ffffff" });
    expect(pixel(canvas, 5, 10)[0]).toBeGreaterThan(100);
    expect(pixel(canvas, 5, 10)[0]).toBeLessThan(160);
  });

  it("leaves the hole of an even-odd shape unpainted", () => {
    const canvas = createCanvas(40, 40, BLACK);
    fillPolygons(canvas, pathPolygons("M5 5 H35 V35 H5 Z M15 15 H25 V25 H15 Z"), {
      color: "#ffffff",
      rule: "evenodd",
    });
    expect(pixel(canvas, 8, 20)).toEqual([255, 255, 255]);
    expect(pixel(canvas, 20, 20)).toEqual([0, 0, 0]);
  });

  it("fills that same shape solid under the nonzero rule", () => {
    const canvas = createCanvas(40, 40, BLACK);
    fillPolygons(canvas, pathPolygons("M5 5 H35 V35 H5 Z M15 15 H25 V25 H15 Z"), {
      color: "#ffffff",
    });
    expect(pixel(canvas, 20, 20)).toEqual([255, 255, 255]);
  });

  it("unions overlapping pieces rather than cancelling them out", () => {
    const canvas = createCanvas(40, 40, BLACK);
    fillPolygons(canvas, [rectPolygon(5, 5, 20, 20), rectPolygon(15, 15, 20, 20)], {
      color: "#ffffff",
    });
    expect(pixel(canvas, 20, 20)).toEqual([255, 255, 255]);
  });

  it("blends a partly transparent fill over what is already there", () => {
    const canvas = createCanvas(10, 10, BLACK);
    fillPolygons(canvas, [rectPolygon(0, 0, 10, 10)], { color: "#ffffff", opacity: 0.5 });
    expect(pixel(canvas, 5, 5)).toEqual([128, 128, 128]);
  });

  it("clips a shape that runs off the canvas", () => {
    const canvas = createCanvas(10, 10, BLACK);
    expect(() =>
      fillPolygons(canvas, [rectPolygon(-50, -50, 200, 200)], { color: "#ffffff" }),
    ).not.toThrow();
    expect(pixel(canvas, 0, 0)).toEqual([255, 255, 255]);
  });

  it("reads three- and six-digit colours", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255]);
    expect(parseColor("#a6ff1a")).toEqual([166, 255, 26]);
  });
});

describe("PNG encoding", () => {
  it("writes a decodable truecolour PNG of the canvas", () => {
    const canvas = createCanvas(4, 3, parseColor("#a6ff1a"));
    const png = encodePng(canvas);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const view = new DataView(png.buffer, png.byteOffset);
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe("IHDR");
    expect(view.getUint32(16)).toBe(4);
    expect(view.getUint32(20)).toBe(3);
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(2); // truecolour, no alpha
  });

  it("round-trips the pixels it was given", () => {
    const canvas = createCanvas(3, 2, parseColor("#000000"));
    paint(canvas, (x, y) => [x * 10, y * 20, 30]);
    const png = encodePng(canvas);
    const view = new DataView(png.buffer, png.byteOffset);
    const at = findChunk(png, "IDAT");
    const raw = inflateSync(png.subarray(at, at + view.getUint32(at - 8)));
    // One filter byte a row, then three bytes a pixel.
    expect(raw.length).toBe(2 * (3 * 3 + 1));
    expect(unfilter(raw, 3)).toEqual([
      [0, 0, 30, 10, 0, 30, 20, 0, 30],
      [0, 20, 30, 10, 20, 30, 20, 20, 30],
    ]);
  });
});

function findChunk(png: Uint8Array, type: string): number {
  for (let at = 8; at < png.length - 8; ) {
    const view = new DataView(png.buffer, png.byteOffset);
    const length = view.getUint32(at);
    if (String.fromCharCode(...png.subarray(at + 4, at + 8)) === type) return at + 8;
    at += length + 12;
  }
  throw new Error(`no ${type} chunk`);
}

/** Undoes the row filters, so a test can assert on the pixels themselves. */
function unfilter(raw: Uint8Array, width: number): number[][] {
  const stride = width * 3;
  const rows: number[][] = [];
  let previous = new Array<number>(stride).fill(0);
  for (let at = 0; at < raw.length; at += stride + 1) {
    const filter = raw[at];
    const row = new Array<number>(stride).fill(0);
    for (let index = 0; index < stride; index += 1) {
      const value = raw[at + 1 + index];
      const left = index >= 3 ? row[index - 3] : 0;
      const up = previous[index];
      const upLeft = index >= 3 ? previous[index - 3] : 0;
      let addend = 0;
      if (filter === 1) addend = left;
      else if (filter === 2) addend = up;
      else if (filter === 3) addend = (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const distances = [
          [Math.abs(estimate - left), left],
          [Math.abs(estimate - up), up],
          [Math.abs(estimate - upLeft), upLeft],
        ] as const;
        addend = distances.reduce((best, candidate) => (candidate[0] < best[0] ? candidate : best))[1];
      }
      row[index] = (value + addend) & 255;
    }
    rows.push(row);
    previous = row;
  }
  return rows;
}
