// Titles of recipes the person was shown recently. A new batch is asked to differ from them, so scanning again right
// after a scan (or regenerating twice) does not hand back the same dishes; a scan days later starts fresh.

export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_RECENT_TITLES = 15;

const clean = (list) =>
  (Array.isArray(list) ? list : []).filter((e) => e && typeof e.title === "string" && e.title.trim() && Number.isFinite(e.at));

/** Drops what is older than the window and keeps the newest MAX_RECENT_TITLES. */
export function pruneRecent(list, now = Date.now()) {
  return clean(list)
    .filter((e) => now - e.at < RECENT_WINDOW_MS && e.at <= now + 60000)
    .slice(-MAX_RECENT_TITLES);
}

/** The list with `titles` added (a title already there is moved to the newest position). */
export function addRecent(list, titles, now = Date.now()) {
  const incoming = (titles || []).filter((t) => typeof t === "string" && t.trim());
  const keys = new Set(incoming.map((t) => t.trim().toLowerCase()));
  const kept = clean(list).filter((e) => !keys.has(e.title.trim().toLowerCase()));
  return pruneRecent([...kept, ...incoming.map((title) => ({ title: title.trim(), at: now }))], now);
}

/** Titles to tell the model to avoid: the batch on screen first, then the recent ones, newest first, no repeats. */
export function titlesToAvoid(currentBatchTitles, recent, now = Date.now()) {
  const seen = new Set();
  const out = [];
  const push = (t) => {
    const key = typeof t === "string" ? t.trim().toLowerCase() : "";
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(t.trim());
  };
  (currentBatchTitles || []).forEach(push);
  [...pruneRecent(recent, now)].reverse().forEach((e) => push(e.title));
  return out.slice(0, MAX_RECENT_TITLES);
}
