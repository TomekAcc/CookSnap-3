/**
 * "Pull past the top and let go" for sheets with scrolling content.
 *
 * A whole-sheet drag cannot work on a sheet whose content scrolls (the two
 * gestures fight), so these sheets use the standard iOS pattern instead: with
 * the list already at the top, keep pulling down; the scroll view rubber-bands
 * to a negative offset, and releasing past `threshold` closes the sheet. Needs
 * the scroll view's bounce (iOS default); on Android the offset never goes
 * negative, so it is simply inert there.
 */
export function pullToCloseHandlers(onClose, threshold = 50) {
  return {
    onScrollEndDrag: (e) => {
      const y = e?.nativeEvent?.contentOffset?.y;
      if (typeof y === "number" && y < -threshold) onClose?.();
    },
  };
}
