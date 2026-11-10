import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markdownToHtml as md } from "../src/markdown.js";

describe("markdownToHtml", () => {
  it("does headings, paragraphs and inline styles", () => {
    assert.equal(md("# Title\n\nHello **bold** and `code`,\nsecond line."), "<h1>Title</h1>\n<p>Hello <strong>bold</strong> and <code>code</code>, second line.</p>");
  });
  it("does lists with continuation lines, bullets and numbers", () => {
    assert.equal(md("- one\n  more\n- two"), "<ul><li>one more</li><li>two</li></ul>");
    assert.equal(md("1. a\n2. b"), "<ol><li>a</li><li>b</li></ol>");
  });
  it("does tables", () => {
    const html = md("| A | B |\n|---|---|\n| 1 | **2** |");
    assert.match(html, /<th>A<\/th><th>B<\/th>/);
    assert.match(html, /<td>1<\/td><td><strong>2<\/strong><\/td>/);
  });
  it("does blockquotes and rules", () => {
    assert.equal(md("> note one\n> note two\n\n---"), "<blockquote>note one note two</blockquote>\n<hr>");
  });
  it("links only http, mailto and site paths, and never lets markup through", () => {
    assert.match(md("[x](https://a.b/c)"), /<a href="https:\/\/a.b\/c">x<\/a>/);
    assert.match(md("[x](/privacy)"), /<a href="\/privacy">x<\/a>/);
    assert.ok(!md("[x](javascript:alert(1))").includes("<a "));
    assert.ok(!md("<script>alert(1)</script>").includes("<script>"));
    assert.ok(md("a < b & c").includes("a &lt; b &amp; c"));
  });
});
