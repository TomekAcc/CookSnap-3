import { STORAGE_KEYS } from "../storage/keys";
import { getItem, setItem } from "../storage/storage";
import { log } from "../utils/log";
import { isPermanentFailure, sendFeedback } from "./feedback";

// Help & Feedback messages are written to the phone first and sent second, so a message is never lost to a bad
// connection or an app that is closed mid-send: it stays here until the server confirms it, and is retried
// whenever the app opens or comes back to the front. The id each message carries makes a repeated send safe:
// the server keeps only one copy.

const MAX_ITEMS = 20;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const newId = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

async function read() {
  try {
    const parsed = JSON.parse((await getItem(STORAGE_KEYS.feedbackOutbox)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const write = (items) => setItem(STORAGE_KEYS.feedbackOutbox, JSON.stringify(items)).catch((err) => log.warn("[CookSnap] outbox write failed:", err?.message));

// Reads and writes of the outbox take turns, so a send that is finishing cannot overwrite a message just added.
let turn = Promise.resolve();
const inTurn = (task) => {
  const run = turn.then(task, task);
  turn = run.catch(() => {});
  return run;
};

/** Stores a message on the phone and returns its id. Call flushFeedbackOutbox() afterwards to send it. */
export function queueFeedback(entry, now = Date.now()) {
  return inTurn(async () => {
    const id = newId();
    const items = await read();
    items.push({ id, queuedAt: now, ...entry });
    await write(items.slice(-MAX_ITEMS));
    return id;
  });
}

/**
 * Sends everything waiting, oldest first. Stops at the first message that could not get through (most likely no
 * connection) and keeps the rest. Resolves to the ids still waiting.
 */
export function flushFeedbackOutbox(now = Date.now()) {
  return inTurn(async () => {
    const items = (await read()).filter((item) => now - (item.queuedAt || 0) < MAX_AGE_MS);
    const waiting = [];
    let stopped = false;
    for (const item of items) {
      if (stopped) {
        waiting.push(item);
        continue;
      }
      const { queuedAt, ...message } = item;
      try {
        await sendFeedback(message);
      } catch (err) {
        if (isPermanentFailure(err)) {
          log.warn("[CookSnap] Dropping a feedback message the server refused:", err?.message);
        } else {
          waiting.push(item);
          stopped = true;
        }
      }
    }
    await write(waiting);
    return waiting.map((item) => item.id);
  });
}
