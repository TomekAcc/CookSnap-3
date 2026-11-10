// A screen that opens Help & Feedback for a specific reason (for example "report this recipe") leaves a note
// here; the sheet takes it once when it opens. Kept out of React state so opening is a single call.

let pending = null;

export function setFeedbackPrefill(value) {
  pending = value || null;
}

/** Returns the note left for the sheet (and clears it), or null. */
export function takeFeedbackPrefill() {
  const value = pending;
  pending = null;
  return value;
}
