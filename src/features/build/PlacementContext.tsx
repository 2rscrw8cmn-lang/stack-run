/**
 * The identity strip above a tower with a block in hand: what you are holding,
 * and how to put it down.
 *
 * It lives inside the construction field rather than in the controls, which is
 * what lets the controls stay one compact row instead of the three-row sheet
 * Personal Build used to open over its own tower. Crew Build arrived at this
 * first (issue #154); this is that strip made shared, so both towers say the
 * same thing in the same place rather than each inventing a way to name the
 * block in hand.
 */
interface PlacementContextProps {
  /**
   * What kind of thing is in hand — "Block in hand", or Crew's "Special Block
   * in hand" for an award. Set in the caller because only the caller knows
   * whether a block is ordinary.
   */
  label: string;
  /** The block itself, e.g. `INTERVALS · 5.4 MI · AUG 30`. */
  identity: string;
  /**
   * How to put it down. Both towers accept a tap and a drag; a rotatable block
   * gets a third sentence, because a control that is never mentioned is a
   * control most people never find.
   */
  hint: string;
}

export function PlacementContext({ label, identity, hint }: PlacementContextProps) {
  return (
    <div className="placement-context">
      <div>
        <p className="machine-label">{label}</p>
        <p className="data-value">{identity}</p>
      </div>
      <p>{hint}</p>
    </div>
  );
}
