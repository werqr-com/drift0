import { describe, expect, it } from "vitest";
import { calculateBallistics } from "./ballistics";
import { trueMuzzleVelocity } from "./truing";
import { aggregateDopeCard, findNearestDope } from "./dopeAggregate";
import type { DopeEntry } from "./supabase/types";

const baseInput = {
  muzzleVelocity: 823,
  bulletWeight: 10.9,
  ballisticCoefficient: 0.462,
  zeroRange: 91.44,
  targetDistance: 914.4,
  windSpeed: 0,
  windAngle: 90,
  sightHeight: 38.1,
  temperature: 15,
  altitude: 0,
};

function makeEntry(
  overrides: Partial<DopeEntry> & {
    distance_m: number;
    elevation_correction: number;
  }
): DopeEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    user_id: "u1",
    rifle_id: "r1",
    location_id: null,
    shot_at: overrides.shot_at ?? "2026-01-01T00:00:00Z",
    distance_m: overrides.distance_m,
    elevation_correction: overrides.elevation_correction,
    windage_correction: overrides.windage_correction ?? 0,
    correction_unit: overrides.correction_unit ?? "moa",
    wind_speed_ms: null,
    wind_angle_deg: null,
    temperature_c: null,
    altitude_m: null,
    pressure_hpa: null,
    group_size_mm: null,
    shots: null,
    ammo_lot: null,
    notes: null,
    client_id: overrides.client_id ?? crypto.randomUUID(),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("trueMuzzleVelocity", () => {
  it("recovers a known muzzle velocity from synthetic DOPE", () => {
    const trueMv = 790;
    const results = calculateBallistics({
      ...baseInput,
      muzzleVelocity: trueMv,
    });

    const observations = [300, 500, 700].map((d) => {
      const closest = results.reduce((best, r) =>
        Math.abs(r.distance - d) < Math.abs(best.distance - d) ? r : best
      );
      return {
        distance_m: d,
        elevation_correction: closest.moa,
        correction_unit: "moa" as const,
      };
    });

    const result = trueMuzzleVelocity(baseInput, observations);
    expect(result.muzzleVelocity).toBeGreaterThan(trueMv - 15);
    expect(result.muzzleVelocity).toBeLessThan(trueMv + 15);
    expect(result.rmsError).toBeLessThan(0.5);
  });

  it("throws when observations are empty", () => {
    expect(() => trueMuzzleVelocity(baseInput, [])).toThrow();
  });
});

describe("aggregateDopeCard", () => {
  it("groups by distance and averages elevations", () => {
    const entries = [
      makeEntry({
        distance_m: 300,
        elevation_correction: 4,
        shot_at: "2026-01-01T00:00:00Z",
      }),
      makeEntry({
        distance_m: 302,
        elevation_correction: 6,
        shot_at: "2026-01-02T00:00:00Z",
      }),
      makeEntry({
        distance_m: 500,
        elevation_correction: 10,
        correction_unit: "mil",
      }),
    ];

    const rows = aggregateDopeCard(entries, "moa", 25);
    expect(rows).toHaveLength(1);
    expect(rows[0].distance_m).toBe(300);
    expect(rows[0].count).toBe(2);
    expect(rows[0].avg_elevation).toBe(5);
    expect(rows[0].latest_elevation).toBe(6);
  });
});

describe("findNearestDope", () => {
  it("returns entries within tolerance sorted by proximity", () => {
    const entries = [
      makeEntry({ distance_m: 490, elevation_correction: 1 }),
      makeEntry({ distance_m: 505, elevation_correction: 2 }),
      makeEntry({ distance_m: 600, elevation_correction: 3 }),
    ];
    const nearest = findNearestDope(entries, 500, "moa", 15);
    expect(nearest).toHaveLength(2);
    expect(nearest[0].distance_m).toBe(505);
  });
});
