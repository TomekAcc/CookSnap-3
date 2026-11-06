import { translate, translateCount, isSlavicFewCount } from "../src/i18n";
import { LANGUAGE_OPTIONS } from "../src/data/languageOptions";

const en = require("../src/i18n/translations/en").default;
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translate", () => {
  it("returns the language's string, falling back to English, then to the key", () => {
    expect(translate("en", "nav.pantry")).toBe("Pantry");
    expect(translate("pl", "nav.pantry")).not.toBe("Pantry");
    expect(translate("xx", "nav.pantry")).toBe("Pantry"); // unknown language
    expect(translate("en", "no.such.key")).toBe("no.such.key");
  });

  it("fills {placeholders}, including repeated ones", () => {
    expect(translate("en", "pantry.removedItem", { name: "Salt" })).toBe('Removed "Salt" from pantry');
  });
});

describe("plural forms", () => {
  it("needs the 2-4 form in Slavic languages except 12-14", () => {
    expect([1, 2, 4, 5, 12, 14, 22, 25].map((n) => isSlavicFewCount("pl", n))).toEqual([
      false, true, true, false, false, false, true, false,
    ]);
    expect(isSlavicFewCount("en", 2)).toBe(false);
  });

  it("falls back to the plain key where a language has no extra form", () => {
    expect(translateCount("en", 3, { few: "scanner.itemsFoundFew", fallback: "scanner.itemsFoundOther" })).toBe(
      "3 items found"
    );
  });
});

// The translation tables are plain objects maintained by hand/codemod across
// 31 languages; these checks catch the drift that otherwise only shows up as a
// raw key or a literal "{count}" on a user's screen.
describe("translation tables", () => {
  const languages = LANGUAGE_OPTIONS.map((l) => l.id);

  it("has a table for every selectable language", () => {
    for (const id of languages) {
      expect(() => require(`../src/i18n/translations/${id}`)).not.toThrow();
    }
  });

  it.each(languages)("%s has exactly the English key set", (id) => {
    const table = require(`../src/i18n/translations/${id}`).default;
    const missing = Object.keys(en).filter((k) => !(k in table));
    const extra = Object.keys(table).filter((k) => !(k in en));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it.each(languages)("%s never invents or drops a {placeholder}", (id) => {
    const table = require(`../src/i18n/translations/${id}`).default;
    const problems = [];
    for (const key of Object.keys(en)) {
      if (!(key in table)) continue;
      const want = placeholders(en[key]);
      const have = placeholders(table[key]);
      const invented = have.filter((p) => !want.includes(p));
      // Singular keys ("...One") may spell the number out ("jeden", "אחד")
      // instead of printing {count}; every other key must keep them all.
      const dropped = key.endsWith("One") ? [] : want.filter((p) => !have.includes(p));
      if (invented.length || dropped.length) problems.push({ key, invented, dropped });
    }
    expect(problems).toEqual([]);
  });
});
