import { useEffect, useRef, useState, type CSSProperties } from "react";
import { WORKOUT_TYPE_LABEL } from "../domain/build";
import type { AppState } from "../domain/types";
import {
  buildPreviewTower,
  type HeightSource,
  type PreviewOptions,
  type WidthRule,
} from "./footprintPreview";
import "./footprintPreview.css";

interface FootprintPreviewProps {
  state: AppState;
  onClose: () => void;
}

/** WCAG 2.2 SC 2.5.8 target size (minimum). */
const MIN_TARGET_PX = 24;
const COURSE_HEIGHT_PX = 18;
/**
 * `.build-site__gauge` plus the stage's own padding. Reserved here so the
 * tower renders exactly as wide as it would on the real Build screen —
 * without it the preview is ~60px optimistic and answers question 3 wrongly.
 */
const RESERVED_PX = 58 + 24 + 12;

const DEFAULTS: PreviewOptions = {
  columns: 10,
  maxWidth: 4,
  widthRule: "bands",
  heightSource: "type",
  wholePlan: true,
};

/**
 * A full-screen preview of the tower proposed in docs/BUILD_CONCEPT.md, so
 * its open questions can be settled by looking rather than by arguing:
 *
 *   1. which width rule reads best      — the Width control
 *   3. whether the grid survives 320px  — the readout flags the narrowest
 *                                         brick when it drops under 24px
 *   4. whether mortar lines inform      — the Weeks toggle
 *
 * It renders over the app rather than inside Build, and computes its own
 * geometry from the plan and the run logs, so no product component or stored
 * placement is involved.
 */
export function FootprintPreview({ state, onClose }: FootprintPreviewProps) {
  const [options, setOptions] = useState<PreviewOptions>(DEFAULTS);
  const [showMortar, setShowMortar] = useState(true);
  const [stageWidth, setStageWidth] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const measure = () => setStageWidth(stage.clientWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const tower = buildPreviewTower(state.plan, state.runLogs, options);
  const { stats } = tower;

  const gridWidth = Math.max(0, stageWidth - RESERVED_PX);
  const unit = gridWidth / options.columns;
  const tooNarrow = unit > 0 && unit < MIN_TARGET_PX;

  function update<K extends keyof PreviewOptions>(
    key: K,
    value: PreviewOptions[K],
  ) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fp-overlay" role="dialog" aria-label="Footprint preview">
      <div className="fp-overlay__bar">
        <div>
          <h2 className="fp-overlay__title">Footprint preview</h2>
          <p className="fp-overlay__note">
            Proposal only — not the real tower, and nothing here is saved.
          </p>
        </div>
        <button type="button" onClick={onClose}>
          close
        </button>
      </div>

      <div className="fp-controls">
        <label className="fp-control">
          Columns
          <select
            value={options.columns}
            onChange={(event) => update("columns", Number(event.target.value))}
          >
            {[6, 7, 8, 9, 10, 12].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="fp-control">
          Widest brick
          <select
            value={options.maxWidth}
            onChange={(event) => update("maxWidth", Number(event.target.value))}
          >
            {[3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="fp-control">
          Width from miles
          <select
            value={options.widthRule}
            onChange={(event) =>
              update("widthRule", event.target.value as WidthRule)
            }
          >
            <option value="bands">bands</option>
            <option value="fine">fine (÷1.5)</option>
            <option value="coarse">coarse (÷2)</option>
          </select>
        </label>

        <label className="fp-control">
          Height from
          <select
            value={options.heightSource}
            onChange={(event) =>
              update("heightSource", event.target.value as HeightSource)
            }
          >
            <option value="type">type</option>
            <option value="effort">effort</option>
            <option value="pace">pace vs your median</option>
          </select>
        </label>

        <label className="fp-control">
          Whole plan
          <input
            type="checkbox"
            checked={options.wholePlan}
            onChange={(event) => update("wholePlan", event.target.checked)}
          />
        </label>

        <label className="fp-control">
          Week lines
          <input
            type="checkbox"
            checked={showMortar}
            onChange={(event) => setShowMortar(event.target.checked)}
          />
        </label>
      </div>

      <p className="fp-readout">
        <span>
          <b>{stats.bricks}</b> bricks
        </span>
        <span>
          <b>{stats.courses}</b> courses
        </span>
        <span>
          <b>{stats.footprints}</b> footprints
        </span>
        <span>
          commonest <b>{stats.histogram[0]?.label ?? "—"}</b> at{" "}
          <b>{Math.round(stats.commonestShare * 100)}%</b>
        </span>
        <span>
          <b>{stats.voids}</b> voids
        </span>
        <span className={tooNarrow ? "fp-readout__warn" : undefined}>
          narrowest brick <b>{unit.toFixed(0)}px</b>
          {tooNarrow ? ` — under the ${MIN_TARGET_PX}px target minimum` : ""}
        </span>
      </p>

      <div className="fp-stage" ref={stageRef}>
        <div
          className="fp-tower"
          style={
            {
              "--fp-columns": options.columns,
              "--fp-course": `${COURSE_HEIGHT_PX}px`,
              width: gridWidth > 0 ? `${gridWidth}px` : undefined,
              gridTemplateRows: `repeat(${stats.courses}, ${COURSE_HEIGHT_PX}px)`,
            } as CSSProperties
          }
        >
          {tower.bricks.map((brick) => (
            <button
              key={brick.workout.id}
              type="button"
              className="fp-brick"
              data-finish={brick.runLog?.effort}
              title={`Week ${brick.workout.weekNumber} · ${WORKOUT_TYPE_LABEL[brick.workout.type]} · ${brick.miles} mi · ${brick.width}×${brick.height}`}
              style={
                {
                  gridColumn: `${brick.x + 1} / span ${brick.width}`,
                  gridRow: `${stats.courses - brick.y - brick.height + 1} / span ${brick.height}`,
                  zIndex: brick.depth,
                  "--piece-color": `var(--${brick.workout.build.colorKey})`,
                } as CSSProperties
              }
            >
              <span className="fp-brick__face fp-brick__face--front" />
              {brick.showTopFace && (
                <span className="fp-brick__face fp-brick__face--top" />
              )}
              {brick.showRightFace && (
                <span className="fp-brick__face fp-brick__face--right" />
              )}
            </button>
          ))}

          {showMortar &&
            tower.mortar.map((line) => (
              <span
                key={line.weekNumber}
                className="fp-mortar"
                style={{ "--fp-y": line.y } as CSSProperties}
              >
                <span className="fp-mortar__label">{line.weekNumber}</span>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
