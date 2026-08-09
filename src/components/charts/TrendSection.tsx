import type { ReactNode } from "react";

export interface TrendRow {
  label: string;
  value: string;
}

interface TrendSectionProps {
  title: string;
  /** What period this covers, in words. Never left to the reader to infer. */
  range?: string | null;
  /**
   * One sentence about what the chart shows. Present whether or not there is
   * enough data — when there is not, it says what would make a trend.
   */
  summary: string;
  /** The chart's values, exactly as drawn. Empty when there is nothing to plot. */
  rows?: TrendRow[];
  /** Column headings for the table view. */
  columns?: [string, string];
  children?: ReactNode;
}

/**
 * The frame every trend wears: a name, the period, the drawing, a sentence,
 * and the same numbers as a table.
 *
 * The table is not a fallback. A chart cannot be read by a screen reader, at
 * high zoom, or by someone who wants the actual figure rather than an
 * impression of it, and this is the one place all three are served by the same
 * markup. It is visually hidden rather than absent — the summary sentence is
 * what a sighted reader gets instead, and both come from the same numbers.
 */
export function TrendSection({ title, range, summary, rows = [], columns = ["Period", "Value"], children }: TrendSectionProps) {
  return (
    <section className="trend">
      <div className="trend__header">
        <h3 className="trend__title">{title}</h3>
        {range && <p className="trend__range">{range}</p>}
      </div>
      {children && <figure className="trend__figure">{children}</figure>}
      <p className="trend__summary">{summary}</p>
      {rows.length > 0 && (
        <table className="visually-hidden">
          <caption>{`${title}${range ? `, ${range}` : ""}`}</caption>
          <thead>
            <tr>
              <th scope="col">{columns[0]}</th>
              <th scope="col">{columns[1]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.label}-${row.value}`}>
                <th scope="row">{row.label}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
