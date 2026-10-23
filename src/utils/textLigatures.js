// React Native's <Text> has no style prop to disable OpenType ligatures, and
// iOS Core Text applies the "fi"/"fl" ligature by default for custom fonts
// that define one (confirmed real failure: Plus Jakarta Sans does, so
// "Profile" rendered with the "f" and "i" fused into one glyph — the dot
// wasn't missing, it was merged away as intended ligature behavior). A zero-
// width non-joiner (U+200C) between the two letters is the standard,
// invisible way to force the text shaper to keep them as separate glyphs.
const ZWNJ = "‌";

export function breakLigatures(text) {
  if (typeof text !== "string") return text;
  return text.replace(/f([ilt])/g, "f" + ZWNJ + "$1");
}
