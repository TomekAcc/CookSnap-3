import { useCallback, useRef } from "react";

/**
 * Remembers each bottom-tab screen's scroll position while the app is open.
 *
 * MainContent (App.jsx) renders one tab at a time and unmounts the others,
 * so without this every switch started the next screen at the top and lost
 * the user's place (confirmed user report: scroll down to the recipes,
 * switch to Pantry and back, and you're at the top again). Positions live in
 * module memory only — a fresh app launch starting at the top is expected.
 * Keeping every tab mounted instead would also remember local state, but it
 * keeps four screens (and the scanner's animations) alive in the background.
 */
const offsets = {};
const handles = {};

/** Tapping the already-active tab: scroll that tab back to the top. */
export function scrollTabToTop(tabId) {
  offsets[tabId] = 0;
  handles[tabId]?.scrollTo?.({ y: 0, animated: true });
}

/** Forget a tab's remembered position (next mount starts at the top). */
export function resetTabScroll(tabId) {
  offsets[tabId] = 0;
}

export function useTabScroll(tabId, externalRef = null) {
  // Restoring is pending until the content is tall enough to scroll to the
  // saved offset (content may still be laying out, e.g. recipe cards), or
  // until the user takes over by dragging. While pending, scroll events are
  // not recorded so the transient 0 from the initial layout can't overwrite
  // the saved position.
  const pending = useRef((offsets[tabId] || 0) > 0);
  const nodeRef = useRef(null);

  const setRef = useCallback(
    (node) => {
      nodeRef.current = node;
      if (externalRef) externalRef.current = node;
      if (node) handles[tabId] = node;
      else if (handles[tabId] === nodeRef.current) delete handles[tabId];
    },
    [tabId, externalRef]
  );

  const onContentSizeChange = useCallback(
    (_w, h) => {
      if (!pending.current) return;
      const y = offsets[tabId] || 0;
      if (y <= 0) {
        pending.current = false;
        return;
      }
      if (h > y) {
        nodeRef.current?.scrollTo?.({ y, animated: false });
        pending.current = false;
      }
    },
    [tabId]
  );

  const onScroll = useCallback(
    (e) => {
      if (pending.current) return;
      offsets[tabId] = e?.nativeEvent?.contentOffset?.y || 0;
    },
    [tabId]
  );

  const onScrollBeginDrag = useCallback(() => {
    pending.current = false;
  }, []);

  return { setRef, onScroll, onContentSizeChange, onScrollBeginDrag, scrollEventThrottle: 16 };
}
