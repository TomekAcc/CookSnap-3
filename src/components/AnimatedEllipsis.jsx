import React, { useEffect, useState } from "react";
import { Text } from "react-native";

/**
 * A genuinely animated "..." — cycles through "", ".", "..", "..." on a
 * steady loop. Confirmed real feedback: the scanning screens' loading
 * labels ("Skanowanie...", "AI analizuje zawartość lodówki...") all ended
 * in a literal, static three-dot string baked into the translation —
 * dead text sitting next to a screen that's otherwise full of motion
 * (the progress bar, the icon pulse, the shimmer sweep). Pairs with
 * stripTrailingEllipsis (see below), which removes that static suffix
 * from the translated text so this is the only ellipsis rendered, not a
 * second one stacked after it.
 */
export default function AnimatedEllipsis({ style, intervalMs = 400 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => (c + 1) % 4);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  // Reserve space for the widest state (three dots) via a fixed-width
  // approach isn't practical with proportional fonts, so the caller's
  // surrounding layout should tolerate a few px of width change — true of
  // every call site here (centered pill text, flexible label row).
  return <Text style={style}>{".".repeat(count)}</Text>;
}

/** Strips a trailing run of "."/"…" (and the whitespace before it) from
 *  translated text, language-independently — dots are dots in every
 *  language, so this needs no per-language logic. No-op on text that
 *  doesn't end in one. */
export function stripTrailingEllipsis(text) {
  return String(text || "").replace(/[.…]+\s*$/, "");
}
