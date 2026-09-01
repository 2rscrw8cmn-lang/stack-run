/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FEATURE_CREW_AWARD_TYPES, type CrewAwardType } from "../../crew/awards.js";
import { AwardBrick } from "./AwardBrick.js";

const ALL_AWARDS: readonly CrewAwardType[] = [
  "miles", "zone2", "pace", "runs", "longHaul", "steady", "onTarget", "levelUp",
];

/** A placed award is one square placement unit (#208), so one cell per edge. */
function renderBrick(
  awardType: CrewAwardType,
  pieceColor = "var(--member-sky)",
  topFace: boolean[] = [true],
  rightFace: boolean[] = [true],
) {
  return render(
    <AwardBrick
      awardType={awardType}
      pieceColor={pieceColor}
      topFace={topFace}
      rightFace={rightFace}
    />,
  ).container;
}

describe("Special Block treatment", () => {
  it("is hollow: a suspended glyph inside a recess, on every award type", () => {
    for (const awardType of ALL_AWARDS) {
      const container = renderBrick(awardType);
      const window = container.querySelector(".award-brick__window");
      expect(window, `${awardType} has no recess`).not.toBeNull();
      expect(window?.querySelector(".award-brick__glyph")).not.toBeNull();
    }
  });

  it("wears the runner's colour as its frame, like a run block of theirs", () => {
    const brick = renderBrick("miles", "var(--member-orchid)")
      .querySelector<HTMLElement>(".award-brick");
    expect(brick?.style.getPropertyValue("--piece-color")).toBe("var(--member-orchid)");
  });

  /**
   * Ownership is the frame colour and nothing else. A second runner mark on
   * the face is the thing this treatment replaced, so its return is a
   * regression rather than an addition.
   */
  it("carries no runner icon on the face", () => {
    const container = renderBrick("onTarget");
    expect(container.querySelector(".runner-icon__part")).toBeNull();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("keeps the run block's 3D face-set so it stacks natively", () => {
    const container = renderBrick("longHaul");
    expect(container.querySelectorAll(".placed-block__face--front")).toHaveLength(1);
    expect(container.querySelectorAll(".placed-block__face--top")).toHaveLength(1);
    expect(container.querySelectorAll(".placed-block__face--right")).toHaveLength(1);
  });

  /**
   * An award draws its depth through the same shared renderer a run block
   * does, so a covered cell breaks a face and an exposed run does not. A
   * placed award is one unit square, but the recap and profile crops hand it
   * whatever footprint their frozen blocks carry.
   */
  it("draws one surface per unbroken run of exposed cells", () => {
    const container = renderBrick(
      "longHaul",
      "var(--member-sky)",
      [true, true, true],
      [true, false, true],
    );
    expect(container.querySelectorAll(".placed-block__face--top")).toHaveLength(1);
    expect(container.querySelectorAll(".placed-block__face--right")).toHaveLength(2);
  });

  it("gives Feature awards no treatment of their own", () => {
    // One coherent family: the glyph and its colour are the only difference
    // between a standard award and a Feature award.
    const standard = renderBrick("miles").innerHTML;
    for (const feature of FEATURE_CREW_AWARD_TYPES) {
      const markup = renderBrick(feature).innerHTML;
      expect(markup.replace(/data-award="\w+"/, "").replace(/<svg[\s\S]*<\/svg>/, ""))
        .toBe(standard.replace(/data-award="\w+"/, "").replace(/<svg[\s\S]*<\/svg>/, ""));
    }
  });
});

describe("Special Block stylesheet", () => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "awardBlock.css"),
    "utf8",
  );

  it("has shed the badge chip and the Feature brass keyline", () => {
    // The approved direction is arcade-simple: no inset UI chips, no extra
    // borders, no brass. Their reappearance means a decorative layer crept back.
    for (const dead of ["award-brick__badge", "award-brick__runner", "210, 170, 98"]) {
      expect(css.includes(dead), `decorative layer returned: ${dead}`).toBe(false);
    }
    expect(css).not.toMatch(/\.award-brick\[data-feature\]/);
  });

  it("keeps every award's own glyph colour independent of the frame", () => {
    for (const award of ALL_AWARDS) {
      expect(css).toMatch(new RegExp(`--award-mark:[^;]+;`));
      if (award !== "miles") {
        expect(css, `${award} has no accent`).toMatch(
          new RegExp(`\\[data-award="${award}"\\][^}]*--award-mark`),
        );
      }
    }
    expect(css).toMatch(/\.award-brick__glyph[^}]*color: var\(--award-mark\)/);
  });
});
