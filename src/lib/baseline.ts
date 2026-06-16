import type { Check } from "@/generated/prisma/client";

interface AnomalyResult {
  isAnomaly: boolean;
  zScore: number;
  expected: number;
  actual: number;
}

export function detectAnomaly(
  check: Pick<Check, "baselineAvg" | "baselineStd">,
  responseTime: number,
): AnomalyResult {
  if (check.baselineAvg == null || check.baselineStd == null) {
    return { isAnomaly: false, zScore: 0, expected: 0, actual: responseTime };
  }

  const zScore =
    check.baselineStd === 0
      ? 0
      : (responseTime - check.baselineAvg) / check.baselineStd;

  return {
    isAnomaly: Math.abs(zScore) > 3,
    zScore,
    expected: check.baselineAvg,
    actual: responseTime,
  };
}
