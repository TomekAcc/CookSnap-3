// A count that starts again from zero each local day — the free-tier limits
// (scans, recipe generations). Pure functions; useFreeTierCap wires them to
// React and storage.
//
// The state is { date, count }. The count that matters is derived: a state
// stamped with an earlier date counts as zero. Resetting that way (instead of
// only when the app starts) means a day boundary crossed while the app stays
// open is handled too — previously yesterday's count was carried over and
// stamped as today's on the next write.

/** Local-date key (YYYY-MM-DD). */
export function todayKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export const emptyCounter = () => ({ date: todayKey(), count: 0 });

/** The count for `today`: zero when the stored state is from another day. */
export function countFor(state, today = todayKey()) {
  return state?.date === today ? Number(state.count) || 0 : 0;
}

/** The state after one more use today. */
export function increment(state, today = todayKey()) {
  return { date: today, count: countFor(state, today) + 1 };
}

/** Stored JSON -> state, or undefined when it isn't a { date, count } object. */
export function parseCounter(value) {
  if (!value || typeof value !== "object" || typeof value.date !== "string") return undefined;
  return { date: value.date, count: Number(value.count) || 0 };
}
