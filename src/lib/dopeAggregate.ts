import type { DopeEntry } from "./supabase/types";

export interface DopeCardRow {
  distance_m: number;
  latest_elevation: number;
  latest_windage: number;
  avg_elevation: number;
  avg_windage: number;
  count: number;
  unit: "moa" | "mil";
  latest_shot_at: string;
}

/**
 * Aggregate DOPE entries into classic card rows (one row per rounded distance).
 * Prefer matching correction_unit; entries in other units are skipped.
 */
export function aggregateDopeCard(
  entries: DopeEntry[],
  unit: "moa" | "mil",
  distanceStepM = 25
): DopeCardRow[] {
  const buckets = new Map<
    number,
    {
      elevations: number[];
      windages: number[];
      latest: DopeEntry;
    }
  >();

  for (const entry of entries) {
    if (entry.correction_unit !== unit) continue;
    const key = Math.round(entry.distance_m / distanceStepM) * distanceStepM;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        elevations: [entry.elevation_correction],
        windages: [entry.windage_correction],
        latest: entry,
      });
      continue;
    }
    existing.elevations.push(entry.elevation_correction);
    existing.windages.push(entry.windage_correction);
    if (new Date(entry.shot_at) > new Date(existing.latest.shot_at)) {
      existing.latest = entry;
    }
  }

  const rows: DopeCardRow[] = [];
  for (const [distance_m, bucket] of buckets) {
    const avg = (nums: number[]) =>
      nums.reduce((a, b) => a + b, 0) / nums.length;
    rows.push({
      distance_m,
      latest_elevation: bucket.latest.elevation_correction,
      latest_windage: bucket.latest.windage_correction,
      avg_elevation: Number(avg(bucket.elevations).toFixed(2)),
      avg_windage: Number(avg(bucket.windages).toFixed(2)),
      count: bucket.elevations.length,
      unit,
      latest_shot_at: bucket.latest.shot_at,
    });
  }

  return rows.sort((a, b) => a.distance_m - b.distance_m);
}

/** Find DOPE entries near a target distance (meters). */
export function findNearestDope(
  entries: DopeEntry[],
  distanceM: number,
  unit: "moa" | "mil",
  toleranceM = 15
): DopeEntry[] {
  return entries
    .filter(
      (e) =>
        e.correction_unit === unit &&
        Math.abs(e.distance_m - distanceM) <= toleranceM
    )
    .sort(
      (a, b) =>
        Math.abs(a.distance_m - distanceM) - Math.abs(b.distance_m - distanceM)
    );
}
