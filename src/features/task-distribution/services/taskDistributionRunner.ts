import { buildFairnessRows } from "./taskDistributionFairness";

function tr(ar: string, en: string) {
  if (typeof document !== "undefined") {
    const lang = String(document.documentElement?.lang || "").toLowerCase();
    if (lang.startsWith("en")) return en;
  }
  return ar;
}

export type DistributionEngine = (params: {
  teachers: any[];
  exams: any[];
  constraints: any;
  runSeed?: number;
}) => any;

export type DistributionTransform = (candidate: any, teachers: any[], constraints: any) => any;
export type DistributionNormalize = (candidate: any) => any;

type DistributionScore = {
  invMissing: number;
  resMissing: number;
  totalMissing: number;
  fairnessSpread: number;
  fairnessStdMilli: number;
  invSpread: number;
  reserveSpread: number;
  overloadedDays: number;
};

export function runTaskDistributionOptimized(params: {
  teachers: any[];
  exams: any[];
  constraints: any;
  engine: DistributionEngine;
  normalize?: DistributionNormalize;
  rebalanceReserve?: DistributionTransform;
  rebalanceInvigilations?: DistributionTransform;
  rebalanceFairness?: DistributionTransform;
}) {
  const {
    teachers,
    exams,
    constraints,
    engine,
    normalize,
    rebalanceReserve,
    rebalanceInvigilations,
    rebalanceFairness,
  } = params;

  const constraintsForEngine: any = {
    ...constraints,
    allowTwoPeriodsSameDayAllDates: !!constraints?.allowTwoPeriodsSameDayAllDates,
    allowTwoPeriodsSameDayDates: Array.isArray(constraints?.allowTwoPeriodsSameDayDates)
      ? constraints.allowTwoPeriodsSameDayDates
      : [],
  };

  const baseSeed = Date.now();
  const attemptsRaw = Number(constraintsForEngine.optimizationAttempts ?? 5) || 5;
  const attempts = Math.max(1, Math.min(20, attemptsRaw));

  let bestOut: any | null = null;
  let bestScore: DistributionScore = {
    invMissing: Number.POSITIVE_INFINITY,
    resMissing: Number.POSITIVE_INFINITY,
    totalMissing: Number.POSITIVE_INFINITY,
    fairnessSpread: Number.POSITIVE_INFINITY,
    fairnessStdMilli: Number.POSITIVE_INFINITY,
    invSpread: Number.POSITIVE_INFINITY,
    reserveSpread: Number.POSITIVE_INFINITY,
    overloadedDays: Number.POSITIVE_INFINITY,
  };

  for (let i = 0; i < attempts; i++) {
    const seed = baseSeed + i * 7919;

    let candidate = engine({
      teachers,
      exams,
      constraints: constraintsForEngine,
      runSeed: seed,
    });

    if (rebalanceReserve) candidate = rebalanceReserve(candidate, teachers, constraintsForEngine);
    if (normalize) candidate = normalize(candidate);
    if (rebalanceInvigilations) candidate = rebalanceInvigilations(candidate, teachers, constraintsForEngine);
    if (rebalanceFairness) candidate = rebalanceFairness(candidate, teachers, constraintsForEngine);

    const score = scoreDistributionRun(candidate, teachers);
    const isBetter = isBetterScore(score, bestScore);

    if (isBetter || !bestOut) {
      bestOut = candidate;
      bestScore = score;
    }
  }

  if (bestOut) {
    if (!bestOut.debug) bestOut.debug = {};
    if (!bestOut.debug.summary) bestOut.debug.summary = {};
    bestOut.debug.summary.optimizationAttemptsUsed = attempts;
    bestOut.debug.summary.optimizationScore = bestScore;
  }

  return bestOut;
}

function isBetterScore(score: DistributionScore, bestScore: DistributionScore) {
  return (
    score.invMissing < bestScore.invMissing ||
    (score.invMissing === bestScore.invMissing && score.resMissing < bestScore.resMissing) ||
    (score.invMissing === bestScore.invMissing &&
      score.resMissing === bestScore.resMissing &&
      score.totalMissing < bestScore.totalMissing) ||
    (score.invMissing === bestScore.invMissing &&
      score.resMissing === bestScore.resMissing &&
      score.totalMissing === bestScore.totalMissing &&
      score.fairnessSpread < bestScore.fairnessSpread) ||
    (score.invMissing === bestScore.invMissing &&
      score.resMissing === bestScore.resMissing &&
      score.totalMissing === bestScore.totalMissing &&
      score.fairnessSpread === bestScore.fairnessSpread &&
      score.fairnessStdMilli < bestScore.fairnessStdMilli) ||
    (score.invMissing === bestScore.invMissing &&
      score.resMissing === bestScore.resMissing &&
      score.totalMissing === bestScore.totalMissing &&
      score.fairnessSpread === bestScore.fairnessSpread &&
      score.fairnessStdMilli === bestScore.fairnessStdMilli &&
      score.overloadedDays < bestScore.overloadedDays) ||
    (score.invMissing === bestScore.invMissing &&
      score.resMissing === bestScore.resMissing &&
      score.totalMissing === bestScore.totalMissing &&
      score.fairnessSpread === bestScore.fairnessSpread &&
      score.fairnessStdMilli === bestScore.fairnessStdMilli &&
      score.overloadedDays === bestScore.overloadedDays &&
      score.invSpread < bestScore.invSpread) ||
    (score.invMissing === bestScore.invMissing &&
      score.resMissing === bestScore.resMissing &&
      score.totalMissing === bestScore.totalMissing &&
      score.fairnessSpread === bestScore.fairnessSpread &&
      score.fairnessStdMilli === bestScore.fairnessStdMilli &&
      score.overloadedDays === bestScore.overloadedDays &&
      score.invSpread === bestScore.invSpread &&
      score.reserveSpread < bestScore.reserveSpread)
  );
}

function toStdMilli(values: number[]) {
  if (!values.length) return 0;
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 1000);
}

function countOverloadedDays(assignments: any[]) {
  const dayPeriods = new Map<string, Set<string>>();
  for (const assignment of assignments || []) {
    const taskType = String(assignment?.taskType || "").trim();
    if (taskType !== "INVIGILATION" && taskType !== "RESERVE") continue;
    const teacherId = String(assignment?.teacherId || "").trim();
    const dateISO = String(assignment?.dateISO || assignment?.date || "").trim();
    const period = String(assignment?.period || "AM").trim().toUpperCase() === "PM" ? "PM" : "AM";
    if (!teacherId || !dateISO) continue;
    const key = `${teacherId}__${dateISO}`;
    if (!dayPeriods.has(key)) dayPeriods.set(key, new Set<string>());
    dayPeriods.get(key)!.add(period);
  }

  let overloadedDays = 0;
  for (const periods of dayPeriods.values()) {
    if (periods.size > 1) overloadedDays += 1;
  }
  return overloadedDays;
}

export function scoreDistributionRun(candidate: any, teachers: any[] = []): DistributionScore {
  const unfilledList: any[] = Array.isArray(candidate?.debug?.unfilled) ? candidate.debug.unfilled : [];
  let invMissing = 0;
  let resMissing = 0;

  for (const slot of unfilledList) {
    const kind = String(slot?.kind || "");
    const required = Number(slot?.required || 0) || 0;
    const assigned = Number(slot?.assigned || 0) || 0;
    const missing = Math.max(0, required - assigned);
    if (kind === "INVIGILATION") invMissing += missing;
    if (kind === "RESERVE") resMissing += missing;
  }

  const assignments = Array.isArray(candidate?.assignments) ? candidate.assignments : [];
  const fairnessRows = buildFairnessRows({
    teachers,
    assignments,
  });

  const totalLoads = fairnessRows.map((row) => Number(row.total || 0));
  const invLoads = fairnessRows.map((row) => Number(row.inv || 0));
  const reserveLoads = fairnessRows.map((row) => Number(row.res || 0));

  const fairnessSpread = totalLoads.length ? Math.max(...totalLoads) - Math.min(...totalLoads) : 0;
  const invSpread = invLoads.length ? Math.max(...invLoads) - Math.min(...invLoads) : 0;
  const reserveSpread = reserveLoads.length ? Math.max(...reserveLoads) - Math.min(...reserveLoads) : 0;
  const overloadedDays = countOverloadedDays(assignments);

  return {
    invMissing,
    resMissing,
    totalMissing: invMissing + resMissing,
    fairnessSpread,
    fairnessStdMilli: toStdMilli(totalLoads),
    invSpread,
    reserveSpread,
    overloadedDays,
  };
}
