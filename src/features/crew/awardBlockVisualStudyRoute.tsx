import "./awardBlockVisualStudy.css";
import { AwardBlockVisualStudy } from "./AwardBlockVisualStudy";

/**
 * Standalone route body for reviewing Special Block artwork before the award
 * model is wired into Crew Build. Keep this isolated from production Crew
 * state so visual iteration cannot affect shared-run placement.
 */
export function AwardBlockVisualStudyRoute() {
  return <AwardBlockVisualStudy />;
}
