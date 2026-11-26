import { useEffect, useRef } from "react";

// How long the detected items stay on screen before the recipes start, so the scan result is seen.
export const SAMPLE_AUTO_GENERATE_DELAY_MS = 1800;

/**
 * The onboarding sample scan ends in recipes without another tap: once the sample scan has finished
 * and found its items, the recipe request goes out by itself, once, with the default meal settings
 * (the settings stay below for changing and regenerating). It deliberately bypasses the free daily
 * generation count: the person did not ask for a generation, they asked to see what the app does.
 * A real scan (scanIsDemo false) re-arms it for the next sample, and a manual Generate press in the
 * meantime cancels it.
 */
export function useSampleAutoGenerate({ scanIsDemo, ready, hasGenerated, isGenerating, generate }) {
  const doneRef = useRef(false);
  const generateRef = useRef(generate);
  generateRef.current = generate;

  useEffect(() => {
    if (!scanIsDemo) {
      doneRef.current = false;
      return undefined;
    }
    if (doneRef.current || !ready || hasGenerated || isGenerating) return undefined;
    const timer = setTimeout(() => {
      doneRef.current = true;
      generateRef.current();
    }, SAMPLE_AUTO_GENERATE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [scanIsDemo, ready, hasGenerated, isGenerating]);
}
