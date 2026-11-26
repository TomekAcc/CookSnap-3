import { MIN_TOUCH, hitSlopFor } from "../src/utils/touch";

describe("hitSlopFor", () => {
  it("brings a tiny control up to 44 points", () => {
    const s = hitSlopFor(14, 14);
    expect(14 + s.left + s.right).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(14 + s.top + s.bottom).toBeGreaterThanOrEqual(MIN_TOUCH);
  });
  it("only widens the side that is too small", () => {
    expect(hitSlopFor(85, 33)).toEqual({ top: 6, bottom: 6, left: 0, right: 0 });
  });
  it("adds nothing to a control that is already big enough", () => {
    expect(hitSlopFor(120, 52)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});
