import { MAX_RECENT_TITLES, RECENT_WINDOW_MS, addRecent, pruneRecent, titlesToAvoid } from "../src/utils/recentRecipeTitles";

const NOW = 1_800_000_000_000;
const HOUR = 3600 * 1000;

describe("recent recipe titles", () => {
  it("keeps what was shown within a day and forgets older titles", () => {
    const list = [
      { title: "Old", at: NOW - RECENT_WINDOW_MS - 1 },
      { title: "Yesterday-ish", at: NOW - 23 * HOUR },
    ];
    expect(pruneRecent(list, NOW).map((e) => e.title)).toEqual(["Yesterday-ish"]);
  });

  it("ignores broken entries", () => {
    expect(pruneRecent([null, { title: "", at: NOW }, { title: "x" }, { title: "Ok", at: NOW }], NOW).map((e) => e.title)).toEqual(["Ok"]);
    expect(pruneRecent("nope", NOW)).toEqual([]);
  });

  it("adds titles without repeating one, and caps the list", () => {
    let list = addRecent([], ["A", "B"], NOW);
    list = addRecent(list, ["a", "C"], NOW + 1000);
    expect(list.map((e) => e.title)).toEqual(["B", "a", "C"]);
    list = addRecent([], Array.from({ length: 40 }, (_, i) => `T${i}`), NOW);
    expect(list).toHaveLength(MAX_RECENT_TITLES);
    expect(list[list.length - 1].title).toBe("T39");
  });

  it("asks to avoid the batch on screen first, then recent titles newest first, without repeats", () => {
    const recent = [
      { title: "Old one", at: NOW - 5 * HOUR },
      { title: "Newer", at: NOW - HOUR },
      { title: "On screen", at: NOW - HOUR },
    ];
    expect(titlesToAvoid(["On screen", "Another"], recent, NOW)).toEqual(["On screen", "Another", "Newer", "Old one"]);
  });

  it("is empty for a first-ever generation", () => {
    expect(titlesToAvoid([], [], NOW)).toEqual([]);
    expect(titlesToAvoid(undefined, undefined, NOW)).toEqual([]);
  });
});
