#!/usr/bin/env node
/**
 * Gemini model resilience check — see .claude/rules/ai-integration.md and
 * .claude/skills/ai-prompt-tuning/SKILL.md.
 *
 * Tests every model listed in src/services/geminiClient.js (VISION_MODELS,
 * RECIPE_MODELS, EDITOR_MODEL) with one trivial generateContent call each, and reports
 * pass/fail per model. The candidate lists are extracted directly from the
 * source files (not hand-copied here), so this check can never silently
 * drift out of sync with what the app actually calls.
 *
 * Re-run this whenever a scan or recipe generation starts failing silently
 * — it's the fastest way to rule "a model got deprecated" in or out before
 * touching any other code. This has already happened once on this project
 * (a hardcoded model returning 404 broke fridge scanning until caught).
 *
 * Usage: node scripts/check-gemini-models.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadApiKey() {
  // The shell environment (CI / cloud sessions) wins over a local .env file.
  if (process.env.EXPO_PUBLIC_GEMINI_API_KEY) return process.env.EXPO_PUBLIC_GEMINI_API_KEY.trim();
  try {
    const envText = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
    const match = envText.match(/EXPO_PUBLIC_GEMINI_API_KEY=(.+)/);
    return (match ? match[1] : "").trim().replace(/['"]/g, "");
  } catch {
    return "";
  }
}

/** Pull every `["gemini-...", ...]`-shaped array (and single `X_MODEL = "gemini-..."`) out of a source file. */
function extractModelArrays(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const results = [];
  const arrayRegex = /(?:const|let)\s+(\w+)\s*=\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = arrayRegex.exec(src))) {
    const [, varName, body] = m;
    const models = [...body.matchAll(/"([a-zA-Z0-9.\-]+)"/g)].map((x) => x[1]);
    if (models.length > 0 && models.every((s) => s.startsWith("gemini"))) {
      results.push({ file: path.basename(filePath), varName, models });
    }
  }
  for (const m of src.matchAll(/(?:const|let)\s+(\w+_MODEL)\s*=\s*"(gemini[a-zA-Z0-9.\-]*)"/g)) {
    results.push({ file: path.basename(filePath), varName: m[1], models: [m[2]] });
  }
  return results;
}

async function checkModel(model, apiKey, retriedOn503 = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: "say hi" }] }] }),
    });
    if (res.ok) return { model, ok: true, status: res.status };
    // 503 is Gemini's transient "model overloaded" — confirmed elsewhere in
    // this project to often clear on an immediate retry. One retry here
    // avoids a false "deprecated" report from a passing glitch.
    if (res.status === 503 && !retriedOn503) {
      return checkModel(model, apiKey, true);
    }
    const text = await res.text().catch(() => "");
    return { model, ok: false, status: res.status, detail: text.slice(0, 200) };
  } catch (err) {
    return { model, ok: false, status: null, detail: err.message };
  }
}

async function main() {
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error("No EXPO_PUBLIC_GEMINI_API_KEY found in .env — nothing to check.");
    process.exit(1);
  }

  const sources = [path.join(ROOT, "src/services/geminiClient.js")];
  const arrays = sources.flatMap(extractModelArrays);

  if (arrays.length === 0) {
    console.error("Could not find any candidate model arrays in the service files — check the regex or source layout.");
    process.exit(1);
  }

  // De-dupe models shared across lists so each is only checked once.
  const modelToSources = new Map();
  for (const { file, varName, models } of arrays) {
    for (const model of models) {
      const label = `${file}:${varName}`;
      if (!modelToSources.has(model)) modelToSources.set(model, []);
      modelToSources.get(model).push(label);
    }
  }

  console.log(`Checking ${modelToSources.size} unique candidate model(s)...\n`);
  const results = [];
  for (const model of modelToSources.keys()) {
    const result = await checkModel(model, apiKey);
    results.push(result);
    const usedBy = modelToSources.get(model).join(", ");
    if (result.ok) {
      console.log(`OK    ${model}  (used by: ${usedBy})`);
    } else {
      console.log(`FAIL  ${model}  (used by: ${usedBy}) — HTTP ${result.status ?? "ERR"}: ${result.detail}`);
    }
  }

  console.log("\n=== SUMMARY ===");
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log("All candidate models are live.");
  } else {
    console.log(`${failed.length} of ${results.length} candidate model(s) failed:`);
    failed.forEach((r) => console.log(`  - ${r.model}`));
    console.log(
      "\nIf any of these are genuinely deprecated (not just transient), remove them from the lists in src/services/geminiClient.js — a dead entry in the list is pure wasted latency on every request that falls through to it."
    );
  }

  // Only treat this as a hard failure if EVERY model in a given list is
  // down — one dead fallback is a cleanup item, not a production break, as
  // long as at least one candidate per list still works.
  let critical = false;
  for (const { file, varName, models } of arrays) {
    const allDead = models.every(
      (m) => results.find((r) => r.model === m)?.ok === false
    );
    if (allDead) {
      critical = true;
      console.log(
        `\nCRITICAL: every model in ${file}:${varName} is down — this path will fail in production right now.`
      );
    }
  }
  if (critical) process.exit(1);
}

main().catch((err) => {
  console.error("CHECK CRASHED:", err);
  process.exit(1);
});
