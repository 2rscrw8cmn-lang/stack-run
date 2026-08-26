import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunProfileChart, type RunProfilePoint } from "./RunProfileChart.js";

const points = (values: Array<number | null>, step = 30): RunProfilePoint[] =>
  values.map((value, index) => ({ timeSeconds: index * step, value }));

function polylines(container: HTMLElement): string[] {
  return [...container.querySelectorAll("polyline.chart__line")].map(
    (line) => line.getAttribute("points") ?? "",
  );
}

describe("RunProfileChart", () => {
  it("renders nothing for fewer than two measured samples", () => {
    const { container } = render(
      <RunProfileChart points={points([140, null, null])} facts={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("states the facts it is given rather than deriving its own", () => {
    render(
      <RunProfileChart
        points={points([140, 160, 150])}
        facts={[
          { label: "Avg", value: "153 bpm" },
          { label: "Max", value: "174 bpm" },
        ]}
      />,
    );
    expect(screen.getByText("153 bpm")).toBeInTheDocument();
    expect(screen.getByText("174 bpm")).toBeInTheDocument();
    // Nothing computed from the samples leaks in beside them.
    expect(screen.queryByText("Low")).not.toBeInTheDocument();
    expect(screen.queryByText("High")).not.toBeInTheDocument();
    expect(screen.queryByText(/^160/)).not.toBeInTheDocument();
    expect(document.querySelector(".run-profile-chart__figure")).toHaveAttribute("aria-hidden", "true");
  });

  it("breaks the line across a gap instead of joining the samples either side", () => {
    const { container } = render(
      <RunProfileChart points={points([140, 150, null, null, 160, 155])} facts={[]} />,
    );
    const lines = polylines(container);
    // Two separate runs of measured samples, never one line drawn over the gap.
    expect(lines).toHaveLength(2);
    expect(lines[0].split(" ")).toHaveLength(2);
    expect(lines[1].split(" ")).toHaveLength(2);
  });

  it("keeps the time position of a gap, so the resumed line restarts further along", () => {
    const { container } = render(
      <RunProfileChart points={points([140, null, null, null, 160, 150])} facts={[]} />,
    );
    // One measured sample before the gap and two after: the lone sample is
    // drawn as a dot, because a one-point polyline would draw nothing at all.
    const lines = polylines(container);
    expect(lines).toHaveLength(1);
    const dot = container.querySelector("circle.chart__dot");
    expect(dot).not.toBeNull();

    const dotX = Number(dot!.getAttribute("cx"));
    const resumedX = Number(lines[0].split(" ")[0].split(",")[0]);
    // The gap kept its time, so the line resumes well past the dot rather
    // than immediately after it.
    expect(resumedX).toBeGreaterThan(dotX);
  });

  it("plots a faster (lower) pace higher on the chart when inverted", () => {
    const { container } = render(
      <RunProfileChart points={points([500, 400])} facts={[]} invert />,
    );
    const [firstPoint, secondPoint] = polylines(container)[0].split(" ");
    const firstPointY = Number(firstPoint.split(",")[1]);
    const secondPointY = Number(secondPoint.split(",")[1]);
    // The faster (400 s/mi) sample is second and sits higher — a smaller y.
    expect(secondPointY).toBeLessThan(firstPointY);
  });

  it("keeps a robust display domain from letting one outlier flatten the rest", () => {
    // Eleven ordinary samples around 660s/mi and one 3212s/mi near-stop, the
    // shape the real August 13 activity has.
    const ordinary = [640, 650, 660, 655, 670, 665, 645, 675, 660, 650, 668];
    const withOutlier = [...ordinary, 3212];
    const scaled = render(
      <RunProfileChart points={points(withOutlier)} facts={[]} invert robustDomain />,
    );
    const robustYs = polylines(scaled.container)[0]
      .split(" ")
      .slice(0, ordinary.length)
      .map((pair) => Number(pair.split(",")[1]));
    scaled.unmount();

    const raw = render(
      <RunProfileChart points={points(withOutlier)} facts={[]} invert />,
    );
    const rawYs = polylines(raw.container)[0]
      .split(" ")
      .slice(0, ordinary.length)
      .map((pair) => Number(pair.split(",")[1]));

    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    // The useful majority of the series uses far more of the plot height once
    // the outlier stops defining the scale.
    expect(spread(robustYs)).toBeGreaterThan(spread(rawYs) * 3);
  });

  it("never modifies the samples it was handed while scaling the display", () => {
    const source: RunProfilePoint[] = points([640, 650, 660, 655, 670, 665, 645, 3212]);
    const snapshot = structuredClone(source);
    render(<RunProfileChart points={source} facts={[]} invert robustDomain />);
    expect(source).toEqual(snapshot);
  });

  it("gives the x-axis elapsed-time context from the samples themselves", () => {
    render(<RunProfileChart points={points([140, 150, 160], 909)} facts={[]} />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("30:18")).toBeInTheDocument();
    expect(screen.getByText("15:09")).toBeInTheDocument();
  });

  it("drops the midpoint label on a run too short for it to say anything", () => {
    render(<RunProfileChart points={points([140, 150], 30)} facts={[]} />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("0:30")).toBeInTheDocument();
    expect(screen.queryByText("0:15")).not.toBeInTheDocument();
  });
});
