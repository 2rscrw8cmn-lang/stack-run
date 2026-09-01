export interface StackRunnerPath {
  fill: string;
  d: string;
}

export const STACK_RUNNER_VIEW_BOX: Readonly<{
  width: number;
  height: number;
}>;

export const STACK_RUNNER_PATHS: readonly Readonly<StackRunnerPath>[];

export function stackRunnerSvgMarkup(): string;
