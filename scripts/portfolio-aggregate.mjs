import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../eval/${file}`, import.meta.url), "utf8"));
const bytes = fs.readFileSync(new URL("../eval/portfolio-aggregate.json", import.meta.url));
const clearedSha256 = "46d9394717bf36daa0284f11af6caf5989e2432192360d9cc9ac3aa2bb9e7f47";
assert.equal(createHash("sha256").update(bytes).digest("hex"), clearedSha256, "The aggregate differs from the cleared export");
const aggregate = JSON.parse(bytes);
const { stageD, bench, desk } = aggregate;

function checkRun(publicRun, archive) {
  const { criteria, quotes, sourceTextBaseline } = archive.draftDiagnostics;
  const { nameTokens, overRedacted } = archive.draftDiagnostics.privacy.overRedaction.ocr;
  assert.deepEqual(
    {
      packets: publicRun.packets, total: publicRun.total, correct: publicRun.correct,
      alwaysFound: publicRun.alwaysFound, falseFound: publicRun.falseFound, notFound: publicRun.notFound,
      falseMissing: publicRun.falseMissing, notMissing: publicRun.notMissing, review: publicRun.review,
      labelReview: publicRun.labelReview, quotes: publicRun.quotes,
      sourceText: publicRun.sourceText, withQuotes: publicRun.withQuotes,
    },
    {
      packets: archive.packets, total: criteria.total, correct: criteria.correct,
      alwaysFound: criteria.alwaysFound.correct, falseFound: criteria.falseFound.count, notFound: criteria.falseFound.of,
      falseMissing: criteria.falseMissing.count, notMissing: criteria.falseMissing.of, review: criteria.sentToReview.count,
      labelReview: criteria.byStatus.needs_review.gold, quotes: quotes.reproduced,
      sourceText: sourceTextBaseline.criteria.correct, withQuotes: criteria.statusAndQuotes,
    },
  );
  if (publicRun.privacy) {
    const { dateTokens, datesRemovedWithoutShift } = archive.draftDiagnostics.privacy;
    assert.deepEqual(publicRun.privacy, { nameTokens, notNames: overRedacted, dates: dateTokens, datesRemoved: datesRemovedWithoutShift });
  }
}

assert.equal(aggregate.schemaVersion, 1);
assert.equal(aggregate.clearance, "previously-published-synthetic-aggregates");
const blind = read("holdout-v2/results/first-score.json").metrics;
const development = read("results/metrics.json");
checkRun(stageD.heldOut, blind);
checkRun(stageD.development, development);
const slice = (rows, id) => rows.find((row) => row.value === id)?.criteria;
const score = (criteria) => criteria ? [criteria.correct, criteria.total, criteria.alwaysFound.correct] : null;
const criterionIds = ["adult", "diagnosis", "lab", "prior", "dose"];
assert.equal(stageD.criteria.length, criterionIds.length);
for (const [index, id] of criterionIds.entries()) {
  const held = slice(blind.slices.criterion, id);
  const dev = slice(development.slices.criterion, id);
  assert.deepEqual(stageD.criteria[index].slice(1), [
    score(held), [held.sentToReview.count, held.total, held.byStatus.needs_review.gold], score(dev),
  ]);
}
const groups = ["clean-render", "fax-noise", "choppy-lines", "smudge", "low-contrast", "rotation-7deg",
  "orientation", "annotations", "ai-handwriting", "mixed-annotations"];
assert.equal(stageD.slices.length, groups.length);
for (const [index, id] of groups.entries()) {
  assert.deepEqual(stageD.slices[index].slice(1), [score(slice(blind.slices.group, id)), score(slice(development.slices.group, id))]);
}
const earlier = read("holdout/results/first-score.json").metrics;
const rebuilt = read("holdout/results/metrics.json");
assert.deepEqual(stageD.firstSet, {
  packets: earlier.packets,
  total: earlier.draftDiagnostics.criteria.total,
  alwaysFound: earlier.draftDiagnostics.criteria.alwaysFound.correct,
  current: rebuilt.draftDiagnostics.criteria.correct,
  earlier: earlier.draftDiagnostics.criteria.correct,
  earlierFalseMissing: earlier.draftDiagnostics.criteria.falseMissing.count,
  notMissing: earlier.draftDiagnostics.criteria.falseMissing.of,
});
assert.equal(bench.totals.calls, stageD.heldOut.total);
assert.equal(bench.totals.packets, stageD.heldOut.packets);
assert.equal(bench.totals.alwaysFound, stageD.heldOut.alwaysFound);
assert.equal(bench.totals.split, stageD.comparison.disputed);
assert.equal(bench.totals.readerMisses, stageD.heldOut.total - stageD.heldOut.correct);
assert.equal(bench.scoreboard.find((row) => row.id === "reader").correct, stageD.heldOut.correct);
assert.equal(bench.routing.autoDecided + bench.routing.desk, bench.routing.calls);
assert.equal(bench.routing.autoDecided - bench.routing.autoCorrect, bench.routing.silent);
assert.deepEqual([desk.packets, desk.calls, desk.auto, desk.desk, desk.silent],
  [bench.totals.packets, bench.routing.calls, bench.routing.autoDecided, bench.routing.desk, bench.routing.silent]);
assert.equal(Object.values(desk.buckets).reduce((sum, count) => sum + count, 0), desk.packets);

if (!process.argv.includes("--check")) process.stdout.write(`${JSON.stringify(aggregate, null, 2)}\n`);
