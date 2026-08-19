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
  column: number;
  row: number;
  runner: number;
}

/**
 * Packed like a real Crew Build rather than laid out as specimen cards.
 * Every outer footprint remains a plain rectangle; only the award face changes.
 */
const AWARD_BLOCKS: readonly AwardBlockDefinition[] = [
  { kind: "onTarget", label: "On Target", shortLabel: "TARGET", width: 2, face: "target", column: 2, row: 3, runner: 2 },
  { kind: "levelUp", label: "Level Up", shortLabel: "LEVEL UP", width: 2, face: "rise", column: 4, row: 3, runner: 3 },
  { kind: "runs", label: "Most Runs", shortLabel: "RUNS", width: 2, face: "stack", column: 1, row: 4, runner: 1 },
  { kind: "zone2", label: "Best Zone 2", shortLabel: "ZONE 2", width: 2, face: "rings", column: 3, row: 4, runner: 0 },
  { kind: "pace", label: "Fastest Avg. Pace", shortLabel: "PACE", width: 2, face: "chevron", column: 5, row: 4, runner: 3 },
  { kind: "steady", label: "Steady", shortLabel: "STEADY", width: 2, face: "equal", column: 7, row: 4, runner: 2 },
  { kind: "longHaul", label: "Long Haul", shortLabel: "LONG", width: 4, face: "span", column: 1, row: 5, runner: 0 },
  { kind: "miles", label: "Most Miles", shortLabel: "MILES", width: 3, face: "heavy", column: 5, row: 5, runner: 1 },
] as const;

interface DemoRunner {
  icon: RunnerIconModel;
  accent: CrewMemberAccent;
}

const DEMO_RUNNERS: readonly DemoRunner[] = [
  {
    accent: "vermilion",
    icon: { background: 2, head: 3, face: 2, body: 1, flair: 1 },
  },
  {
    accent: "aqua",
    icon: { background: 4, head: 2, face: 3, body: 4, flair: 5 },
  },
  {
    accent: "green",
    icon: { background: 3, head: 5, face: 1, body: 2, flair: 3 },
  },
  {
    accent: "magenta",
    icon: { background: 1, head: 0, face: 5, body: 5, flair: 6 },
  },
] as const;

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
  const runner = DEMO_RUNNERS[block.runner];

  return (
    <li
      className="award-study__block"
      data-award={block.kind}
      style={
        {
          gridColumn: `${block.column} / span ${block.width}`,
          gridRow: block.row,
          zIndex: 20 - block.row,
        } as CSSProperties
      }
      aria-label={`${block.label} award block visual study`}
    >
      <span className="award-study__brick">
        <span className="award-study__top" aria-hidden="true" />
        <span className="award-study__right" aria-hidden="true" />
        <span className="award-study__front">
          <span className="award-study__identity" aria-hidden="true">
            <RunnerIcon icon={runner.icon} accent={runner.accent} size={13} />
          </span>
          <span className="award-study__badge" aria-hidden="true">
            <AwardGlyph face={block.face} />
          </span>
          <span className="award-study__hardware" aria-hidden="true"><i /><i /></span>
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
          Zero-mile award pieces. The small runner stamp identifies who won it; the oversized face mark identifies the award.
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
