// Hook that pairs a tour with its completion flag.
//
// `eligible` decides whether the tour may auto-start; a replay can always be
// requested manually. Completion is written once, per account, locally.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isGuidanceComplete,
  markGuidanceComplete,
  type GuidanceEndReason,
  type GuidanceFlag,
} from './guidanceModel';

export const useGuidance = (flag: GuidanceFlag, eligible: boolean) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!eligible || seeded) return;
    if (isGuidanceComplete(flag, userId)) { setSeeded(true); return; }
    setSeeded(true);
    setOpen(true);
  }, [eligible, seeded, flag, userId]);

  // Skipping and completing are equally final: guidance never nags.
  const end = useCallback((_reason: GuidanceEndReason) => {
    markGuidanceComplete(flag, userId);
    setOpen(false);
  }, [flag, userId]);

  const replay = useCallback(() => setOpen(true), []);

  /** Record completion without ever showing the tour (established accounts). */
  const suppress = useCallback(() => {
    if (!isGuidanceComplete(flag, userId)) markGuidanceComplete(flag, userId);
    setSeeded(true);
  }, [flag, userId]);

  return { open, end, replay, suppress };
};
