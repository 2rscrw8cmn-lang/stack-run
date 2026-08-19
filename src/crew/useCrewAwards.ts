import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseAvailability } from "./supabaseClient";
import {
  loadCrewAwards,
  placeCrewAwardBlock,
} from "./crewAwardsService";
import { CrewBuildPlacementError } from "./crewBuildPlacement";
import type { CrewAwardBlockRecord } from "./awards";

export interface CrewAwardsController {
  available: boolean;
  loading: boolean;
  blocks: CrewAwardBlockRecord[];
  placementPending: boolean;
  placementError: string | null;
  refresh: (syncLocalMetrics?: boolean) => Promise<void>;
  placeAward: (awardId: string, row: number, columnStart: number) => Promise<boolean>;
  clearPlacementError: () => void;
}

const EMPTY: Pick<CrewAwardsController, "blocks"> = {
  blocks: [],
};

export function useCrewAwards(input: {
  crewId: string | null;
  viewerUserId: string | null | undefined;
}): CrewAwardsController {
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(EMPTY);
  const [placementPending, setPlacementPending] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const request = useRef(0);

  const refresh = useCallback(async (syncLocalMetrics = true): Promise<void> => {
    const availability = getSupabaseAvailability();
    if (!availability.configured || !input.crewId || !input.viewerUserId) {
      setAvailable(false);
      setState(EMPTY);
      return;
    }
    const sequence = ++request.current;
    setLoading(true);
    try {
      const loaded = await loadCrewAwards(availability.client, {
        crewId: input.crewId,
        viewerUserId: input.viewerUserId,
        syncLocalMetrics,
      });
      if (sequence !== request.current) return;
      setAvailable(loaded.available);
      setState({ blocks: loaded.blocks });
    } catch {
      if (sequence !== request.current) return;
      // Awards are additive to Crew. A failed award read can never take down
      // the existing tower or the runner's personal STACK.
      setAvailable(false);
      setState(EMPTY);
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [input.crewId, input.viewerUserId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const placeAward = useCallback(async (
    awardId: string,
    row: number,
    columnStart: number,
  ): Promise<boolean> => {
    const availability = getSupabaseAvailability();
    if (!availability.configured || placementPending) return false;
    setPlacementPending(true);
    setPlacementError(null);
    try {
      await placeCrewAwardBlock(availability.client, { awardBlockId: awardId, row, columnStart });
      await refresh(false);
      return true;
    } catch (reason) {
      if (reason instanceof CrewBuildPlacementError && reason.kind === "conflict") {
        setPlacementError("That space was just taken. Choose another spot.");
        await refresh(false);
      } else if (reason instanceof CrewBuildPlacementError && reason.kind === "unsupported") {
        setPlacementError("That block needs support from the Crew Build.");
      } else if (reason instanceof CrewBuildPlacementError && reason.kind === "supporting") {
        setPlacementError("That award is supporting part of the Crew Build.");
      } else {
        setPlacementError("Your award block could not be placed. Refresh and try again.");
      }
      return false;
    } finally {
      setPlacementPending(false);
    }
  }, [placementPending, refresh]);

  return {
    available,
    loading,
    blocks: state.blocks,
    placementPending,
    placementError,
    refresh,
    placeAward,
    clearPlacementError: () => setPlacementError(null),
  };
}
