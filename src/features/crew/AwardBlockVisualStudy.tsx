import type { CSSProperties } from "react";
import { RunnerIcon } from "./RunnerIcon";
import type { CrewMemberAccent } from "../../crew/memberAccent";
import type { RunnerIcon as RunnerIconModel } from "../../crew/runnerIcon";

export type AwardBlockKind =
  | "miles"
  | "zone2"
  | "pace"
  | "runs"
  | "longHaul"
  | "steady"
  | "onTarget"
  | "levelUp";

interface AwardBlockDefinition {
  kind: AwardBlockKind;
  label: string;
  shortLabel: string;
  width: 2 | 3 | 4;
  face: "heavy" | "rings" | "chevron" | "stack" | "span" | "equal" | "target" | "rise";
}

const AWARD_BLOCKS: readonly AwardBlockDefinition[] = [
  { kind: "miles", label: "Most Miles", shortLabel: "MILES", width: 3, face: "heavy" },
  { kind: "zone2", label: "Best Zone 2", shortLabel: "ZONE 2", width: 2, face: "rings" },
  { kind: "pace", label: "Fastest Avg. Pace", shortLabel: "PACE", width: 2, face: "chevron" },
  { kind: "runs", label: "Most Runs", shortLabel: "RUNS", width: 2, face: "stack" },
  { kind: "longHaul", label: "Long Haul", shortLabel: "LONG", width: 4, face: "span" },
  { kind: "steady", label: "Steady", shortLabel: "STEADY", width: 2, face: "equal" },
  { kind: "onTarget", label: "On Target", shortLabel: "TARGET", width: 2, face: "target" },
  { kind: "levelUp", label: "Level Up", shortLabel: "LEVEL UP", width: 2, face: "rise" },
] as const;

const DEMO_ICON: RunnerIconModel = {
  background: 2,
  head: 3,
  face: 2,
  body: 1,
  flair: 1,
};

const DEMO_ACCENT: CrewMemberAccent = "vermilion";

function AwardGlyph({ face }: { face: AwardBlockDefinition["face"] }) {
  switch (face) {
    case "heavy":
      return <span className="award-study__glyph award-study__glyph--heavy"><i /><i /><i /></span>;
    case "rings":
      return <span className="award-study__glyph award-study__glyph--rings"><i /><i /></span>;
    case "chevron":
      return <span className="award-study__glyph award-study__glyph--chevron"><i /><i /></span>;
    case "stack":
      return <span className="award-study__glyph award-study__glyph--stack"><i /><i /><i /></span>;
    case "span":
      return <span className="award-study__glyph award-study__glyph--span"><i /></span>;
    case "equal":
      return <span className="award-study__glyph award-study__glyph--equal"><i /><i /></span>;
    case "target":
      return <span className="award-study__glyph award-study__glyph--target"><i /><i /></span>;
    case "rise":
      return <span className="award-study__glyph award-study__glyph--rise"><i /><i /><i /></span>;
  }
}

function AwardStudyBlock({ block }: { block: AwardBlockDefinition }) {
  return (
    <li
      className="award-study__block"
      data-award={block.kind}
      style={{ "--award-width": block.width } as CSSProperties}
      aria-label={`${block.label} award block visual study`}
    >
      <span className="award-study__brick">
        <span className="award-study__top" aria-hidden="true" />
        <span className="award-study__right" aria-hidden="true" />
        <span className="award-study__front">
          <span className="award-study__identity" aria-hidden="true">
            <RunnerIcon icon={DEMO_ICON} accent={DEMO_ACCENT} size={18} />
          </span>
          <AwardGlyph face={block.face} />
          <span className="award-study__wordmark">{block.shortLabel}</span>
        </span>
      </span>
    </li>
  );
}

/**
 * Visual-only study for Crew Special Blocks.
 *
 * It deliberately does not touch Crew Build state, shared_runs, placement,
 * mileage, or the existing Brick primitive. The blocks use only rectangular
 * grid footprints so the approved artwork can later be moved onto the real
 * Crew Build without changing collision geometry.
 */
export function AwardBlockVisualStudy() {
  return (
    <section className="award-study" aria-labelledby="award-study-title">
      <header className="award-study__header">
        <p className="machine-label">Crew Build / visual study</p>
        <h2 id="award-study-title">Special Blocks</h2>
        <p>
          Eight zero-mile award pieces. Runner icon identifies the winner; face treatment identifies the award.
        </p>
      </header>

      <div className="award-study__stage">
        <ul className="award-study__tower" aria-label="Stack of all Special Block concepts">
          {AWARD_BLOCKS.map((block) => <AwardStudyBlock key={block.kind} block={block} />)}
        </ul>
      </div>

      <div className="award-study__key">
        {AWARD_BLOCKS.map((block) => (
          <div key={block.kind} className="award-study__key-row">
            <span className="machine-label">{block.shortLabel}</span>
            <span>{block.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
