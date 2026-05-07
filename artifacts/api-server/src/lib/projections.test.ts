import assert from "node:assert/strict";
import {
  computeProjections,
  type HafidhTier,
  type ProjectionResponse,
} from "./projections.js";

function pages(start: number, end: number) {
  return new Set(Array.from({ length: end - start + 1 }, (_, index) => start + index));
}

function pagesFromRanges(ranges: Array<[number, number]>) {
  const result = new Set<number>();
  for (const [start, end] of ranges) {
    for (let page = start; page <= end; page += 1) {
      result.add(page);
    }
  }
  return result;
}

function tier(response: ProjectionResponse, value: HafidhTier) {
  const found = response.tiers.find((item) => item.tier === value);
  assert.ok(found, `Missing ${value}`);
  return found;
}

function weeksUntil(value: string | null) {
  assert.ok(value, "Expected projected date");
  const today = new Date();
  const start = new Date(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}T12:00:00`,
  );
  const end = new Date(`${value}T12:00:00`);
  return (end.getTime() - start.getTime()) / (86_400_000 * 7);
}

{
  const response = computeProjections({
    memorizedPagesSet: new Set(),
    pacePagesPerWeek: 0,
    recentPacePagesPerWeek: null,
    activeTier: null,
    targetDate: null,
  });

  assert.equal(response.recentPacePagesPerWeek, null);
  for (const item of response.tiers) {
    assert.equal(item.projectedCompletionDate, null);
  }
}

{
  const response = computeProjections({
    memorizedPagesSet: new Set(),
    pacePagesPerWeek: 5,
    recentPacePagesPerWeek: null,
    activeTier: "full_hafidh",
    targetDate: null,
  });
  const weeks = weeksUntil(tier(response, "full_hafidh").projectedCompletionDate);

  assert.ok(weeks >= 120 && weeks <= 122);
}

{
  const response = computeProjections({
    memorizedPagesSet: pages(582, 604),
    pacePagesPerWeek: 5,
    recentPacePagesPerWeek: null,
    activeTier: "juz_amma",
    targetDate: null,
  });

  assert.equal(tier(response, "juz_amma").pagesRemaining, 0);
  assert.equal(tier(response, "full_hafidh").pagesRemaining, 581);
}

{
  const response = computeProjections({
    memorizedPagesSet: pages(1, 100),
    pacePagesPerWeek: 5,
    recentPacePagesPerWeek: null,
    activeTier: "full_hafidh",
    targetDate: null,
  });

  assert.equal(tier(response, "juz_amma").pagesRemaining, 23);
  assert.equal(tier(response, "full_hafidh").pagesRemaining, 504);
}

{
  const response = computeProjections({
    memorizedPagesSet: pagesFromRanges([[1, 100], [582, 604]]),
    pacePagesPerWeek: 5,
    recentPacePagesPerWeek: 2.5,
    activeTier: null,
    targetDate: null,
  });
  const remaining = response.tiers.map((item) => item.pagesRemaining);
  const dates = response.tiers.map((item) => item.projectedCompletionDate);

  assert.equal(response.recentPacePagesPerWeek, 2.5);
  for (let index = 1; index < remaining.length; index += 1) {
    assert.ok(remaining[index] >= remaining[index - 1]);
    assert.ok(dates[index]! >= dates[index - 1]!);
  }
}

console.log("projection tests passed");
