import { useCallback } from "react";
import { useAudioPlayer } from "expo-audio";

const SCAN_COMPLETE_SOUND = require("../../assets/sounds/scan-complete.wav");

/**
 * Short, unobtrusive two-note chime played the instant a fridge/pantry
 * scan genuinely finishes — confirmed real feedback from a tester: scan
 * completion had no audio cue at all, only a visual one, which didn't
 * feel as satisfying/confirmable as it should for something that just
 * took several seconds. useAudioPlayer keeps one player instance alive
 * for this component's lifetime (cheap — it's a 0.6s local asset, not a
 * stream) rather than constructing a new one on every call. seekTo(0) is
 * required before every play() past the first: without it, calling
 * play() again after the clip already finished once is a silent no-op
 * on iOS (confirmed against expo-audio's own behavior) since the
 * player's position is still sitting at the end of the file — exactly
 * the case a user hits on their second, third, ... scan.
 */
export function useScanCompleteSound() {
  const player = useAudioPlayer(SCAN_COMPLETE_SOUND);

  const playScanCompleteSound = useCallback(() => {
    try {
      player.seekTo(0);
      player.play();
    } catch (err) {
      // Never let a sound-effect failure (e.g. silent/DND mode edge case
      // on some Android OEMs) surface to the user or interrupt the scan
      // choreography — this is a pure nice-to-have.
      console.warn("[Cook AI] scan-complete sound failed:", err?.message);
    }
  }, [player]);

  return playScanCompleteSound;
}
