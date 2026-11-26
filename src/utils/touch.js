// Small controls (a 14px "x" on a chip, a 27px "Add") stay small to look right, but the area that reacts to a finger
// should still be at least 44 x 44 points (Apple's guideline; Google asks for 48dp). hitSlop adds invisible
// reaction area around a control without changing how it looks.

export const MIN_TOUCH = 44;

/** hitSlop that brings a control of the given size up to `min` points in each direction (never negative). */
export function hitSlopFor(width, height, min = MIN_TOUCH) {
  const x = Math.max(0, Math.ceil((min - width) / 2));
  const y = Math.max(0, Math.ceil((min - height) / 2));
  return { top: y, bottom: y, left: x, right: x };
}
