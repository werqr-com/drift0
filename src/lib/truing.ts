import type { BallisticsInput } from "./ballistics";
import { calculateBallistics } from "./ballistics";

export interface DopeObservation {
  distance_m: number;
  elevation_correction: number;
  correction_unit: "moa" | "mil";
}

export interface TruingResidual {
  distance_m: number;
  observed: number;
  predicted: number;
  residual: number;
  unit: "moa" | "mil";
}

export interface TruingResult {
  muzzleVelocity: number;
  rmsError: number;
  residuals: TruingResidual[];
}

function predictedCorrection(
  input: BallisticsInput,
  distanceM: number,
  unit: "moa" | "mil"
): number {
  const results = calculateBallistics({
    ...input,
    targetDistance: Math.max(distanceM, input.zeroRange, 1),
  });

  let closest = results[0];
  let minDiff = Number.POSITIVE_INFINITY;
  for (const r of results) {
    const diff = Math.abs(r.distance - distanceM);
    if (diff < minDiff) {
      minDiff = diff;
      closest = r;
    }
  }

  // Engine positive moa/mil = drop below POA = "up" correction needed.
  return unit === "moa" ? closest.moa : closest.mil;
}

function rmsError(
  input: BallisticsInput,
  observations: DopeObservation[],
  muzzleVelocity: number
): { error: number; residuals: TruingResidual[] } {
  const trial: BallisticsInput = { ...input, muzzleVelocity };
  const residuals: TruingResidual[] = [];
  let sumSq = 0;

  for (const obs of observations) {
    const predicted = predictedCorrection(
      trial,
      obs.distance_m,
      obs.correction_unit
    );
    const residual = predicted - obs.elevation_correction;
    sumSq += residual * residual;
    residuals.push({
      distance_m: obs.distance_m,
      observed: obs.elevation_correction,
      predicted,
      residual,
      unit: obs.correction_unit,
    });
  }

  return {
    error: Math.sqrt(sumSq / observations.length),
    residuals,
  };
}

/**
 * Solve for muzzle velocity that best matches recorded elevation DOPE.
 * Uses golden-section search over [0.7x, 1.3x] of the starting MV.
 */
export function trueMuzzleVelocity(
  input: BallisticsInput,
  observations: DopeObservation[]
): TruingResult {
  if (observations.length === 0) {
    throw new Error("At least one DOPE observation is required");
  }

  const loBound = input.muzzleVelocity * 0.7;
  const hiBound = input.muzzleVelocity * 1.3;
  const phi = (1 + Math.sqrt(5)) / 2;
  const invPhi = 1 / phi;

  let a = loBound;
  let b = hiBound;
  let c = b - (b - a) * invPhi;
  let d = a + (b - a) * invPhi;
  let fc = rmsError(input, observations, c).error;
  let fd = rmsError(input, observations, d).error;

  for (let i = 0; i < 40; i++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - (b - a) * invPhi;
      fc = rmsError(input, observations, c).error;
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + (b - a) * invPhi;
      fd = rmsError(input, observations, d).error;
    }
  }

  const muzzleVelocity = (a + b) / 2;
  const { error, residuals } = rmsError(input, observations, muzzleVelocity);

  return {
    muzzleVelocity: Number(muzzleVelocity.toFixed(2)),
    rmsError: Number(error.toFixed(3)),
    residuals: residuals.map((r) => ({
      ...r,
      observed: Number(r.observed.toFixed(2)),
      predicted: Number(r.predicted.toFixed(2)),
      residual: Number(r.residual.toFixed(2)),
    })),
  };
}
