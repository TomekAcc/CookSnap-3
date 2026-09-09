/**
 * CookSnap design tokens — the single source of truth for size, shape and
 * accent decisions.
 *
 * Why this exists: an audit of the app found 20 distinct fontSize values,
 * 22 distinct borderRadius values, 12 distinct greens and 7 distinct icon
 * stroke widths, all hand-picked per component. Individually each choice
 * looked fine; collectively they were the reason the app read as "not
 * harmonized" — two chips that should match ended up 500 vs 600 weight,
 * two accents ended up two different greens, two sibling corners ended up
 * 16 and 18. None of that is fixable one screen at a time.
 *
 * Rule going forward: new UI picks from these scales. If a value you need
 * isn't here, that's a design decision worth making deliberately — widen
 * the scale here rather than inventing a one-off at the call site.
 */

/**
 * Type scale — six steps, each far enough from its neighbour to read as a
 * deliberate level rather than a near-miss. The old set ran 9,10,11,12,13,
 * 14,15,16,17,18,19,20,21,22 — every number in the range, which is what
 * made equivalent text on different screens land a pixel apart.
 */
export const TYPE = {
  caption: 11, // uppercase micro-labels, badge text, hints
  small: 13, // secondary/meta text under a title
  body: 15, // default reading text
  title: 17, // card titles, list-row titles
  heading: 20, // section headings, screen titles
  display: 24, // hero numbers, sheet titles
};

/**
 * Weight scale. Deliberately only three: anything in between (500 vs 600)
 * is invisible on its own and only shows up as inconsistency when two of
 * them sit side by side — which is exactly the bug found on the craving
 * pills vs the meal-type pills.
 */
export const WEIGHT = {
  regular: "500",
  medium: "600", // chips, secondary labels, meta text
  bold: "800", // titles, headings, emphasis
};

/**
 * Radius by ROLE, not by number — four shapes for the whole app.
 *
 * Note on circles: a perfectly round control sets radius to half its own
 * size (a 52px circle needs 26), so those stay as computed values and are
 * NOT snapped to this scale — `pill` covers anything that should be fully
 * round regardless of size.
 */
export const RADIUS = {
  control: 12, // small buttons, checkboxes, inline chips
  tile: 16, // emoji tiles, inputs, inner surfaces
  card: 24, // cards, sheets, modals
  pill: 999, // fully rounded
};

/** Spacing on a 4-point grid. No more 7s and 13s. */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

/**
 * Icons — three sizes and a stated stroke rule.
 *
 * The stroke rule is optical, not arbitrary: a 2px stroke that reads
 * correctly at 18px looks thin at 12px, so small icons step up one notch.
 * That's the whole rule — 2.0 at 16px and above, 2.5 below. The app
 * previously mixed 1.6/2/2.2/2.5/2.75/3/3.5, sometimes three of them
 * inside a single card.
 */
export const ICON = {
  sm: 14,
  md: 18,
  lg: 24,
  strokeSmall: 2.5, // for icons under 16px
  stroke: 2, // for icons 16px and above
};

/** Returns the correct stroke for an icon size, per the rule above. */
export function strokeFor(size) {
  return size < 16 ? ICON.strokeSmall : ICON.stroke;
}

/**
 * Line height for a Text that renders an EMOJI.
 *
 * Emoji glyphs draw taller than the ascent React Native reserves for a
 * normal text run, so an explicit lineHeight sized like body text clips
 * the top of the taller ones — 🥐 and 🍯 are the usual first casualties.
 * Confirmed on device: the croissant on the Breakfast pill was cut off
 * across the top at fontSize 18 / lineHeight 22 (1.22x).
 *
 * 1.4x clears every glyph in the app's sets with headroom to spare. The
 * safest option of all is to set no lineHeight at all on an emoji Text —
 * do that where the layout allows it, and use this where a value is
 * needed.
 */
export function emojiLine(fontSize) {
  return Math.ceil(fontSize * 1.4);
}

/**
 * The green. There was no single one before: #10B981 (56 uses), #059669
 * (36), #34C759 (5), #30D158 (2), #047857 (2) were all "the app's green",
 * and ThemeContext's accentGreen disagreed with what components actually
 * rendered. Emerald wins because it's overwhelmingly the most used and it
 * matches the CookSnap wordmark.
 */
export const GREEN = {
  primary: "#10B981", // accents, selected states, the wordmark
  deep: "#059669", // filled buttons, icons on white
  ink: "#047857", // green text on a soft green ground
  soft: "#ECFDF5", // soft fill (light)
  softBorder: "#D1FAE5", // soft border (light)
  darkSoft: "#064E3B", // soft fill (dark)
  darkBorder: "#065F46", // soft border (dark)
  darkInk: "#6EE7B7", // green text (dark)
};

export default { TYPE, WEIGHT, RADIUS, SPACE, ICON, GREEN, strokeFor };
