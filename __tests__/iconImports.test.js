const fs = require("fs");
const path = require("path");

// Every icon a file imports from the app's icon module must be one it actually exports;
// importing a missing name gives `undefined` and crashes the screen only when it renders.
const SRC = path.join(__dirname, "..", "src");
const exported = new Set(
  [...fs.readFileSync(path.join(SRC, "icons.js"), "utf8").matchAll(/default as (\w+) \}/g)].map((m) => m[1])
);

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.(jsx?|tsx?)$/.test(e.name) ? [full] : [];
  });
}

describe("icon imports", () => {
  it("only ask the icon module for icons it exports", () => {
    const problems = [];
    for (const file of sourceFiles(SRC)) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](?:\.{1,2}\/)+icons["']/g)) {
        for (const part of m[1].split(",")) {
          const name = part.trim().split(/\s+as\s+/)[0];
          if (name && !exported.has(name)) problems.push(`${path.relative(SRC, file)}: ${name}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("finds the icon module's exports", () => {
    expect(exported.size).toBeGreaterThan(30);
    expect(exported.has("Camera")).toBe(true);
  });
});
