// The three summary columns share the card equally. When a language's words would still not fit at the
// smallest font the columns may shrink to, the summary is laid out as three stacked rows instead of
// cutting words off (a 360pt-wide Android phone in German, Russian, Greek, ...). Character widths are
// estimates calibrated on the real fonts: about 0.56 of the font size per character.
const AVG_CHAR = 0.56;
const COL_PADDING = 24; // summaryCol paddingHorizontal 12 x 2
const CHEVRON_SPACE = 16; // 12px icon + 4px gap

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
