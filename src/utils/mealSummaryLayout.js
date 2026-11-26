// The three summary columns share the card equally. When a language's words would still not fit at the
// smallest font the columns may shrink to, the summary is laid out as three stacked rows instead of
// cutting words off (a 360pt-wide Android phone in German, Russian, Greek, ...). Character widths are
// estimates calibrated on the real fonts (measured in the rendered app across 22 languages, widths 320-393):
// the widest words come to 0.56-0.60 of the font size per character, and the text box is about 32 px narrower
// than its column (label) and 45 px narrower where a chevron sits next to the value.
const AVG_CHAR = 0.6;
const COL_PADDING = 32;
const CHEVRON_SPACE = 13;

export function summaryNeedsStacking(fields, innerWidth) {
  if (!innerWidth) return false;
  const colWidth = (innerWidth - 2) / 3; // two hairline dividers
  const labelRoom = colWidth - COL_PADDING;
  const valueRoom = colWidth - COL_PADDING - CHEVRON_SPACE;
  return fields.some(
    (f) =>
      String(f.label).length * 12 * AVG_CHAR * 0.85 > labelRoom ||
      String(f.value).length * 15 * AVG_CHAR * 0.8 > valueRoom
  );
}
