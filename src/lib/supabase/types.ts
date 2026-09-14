export type UnitSystem = "imperial" | "metric";
export type ScopeUnit = "moa" | "mil";

export interface Profile {
  id: string;
  display_name: string | null;
  unit_system: UnitSystem;
  default_click_value: string;
  created_at: string;
  updated_at: string;
}

export interface Rifle {
  id: string;
  user_id: string;
  name: string;
  muzzle_velocity_ms: number;
  bullet_weight_g: number;
  ballistic_coefficient: number;
  zero_range_m: number;
  sight_height_mm: number;
  click_value: string;
  scope_unit: ScopeUnit;
  trued_muzzle_velocity_ms: number | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  user_id: string;
  name: string;
  altitude_m: number;
  lat: number | null;
  lon: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DopeEntry {
  id: string;
  user_id: string;
  rifle_id: string;
  location_id: string | null;
  shot_at: string;
  distance_m: number;
  elevation_correction: number;
  windage_correction: number;
  correction_unit: ScopeUnit;
  wind_speed_ms: number | null;
  wind_angle_deg: number | null;
  temperature_c: number | null;
  altitude_m: number | null;
  pressure_hpa: number | null;
  group_size_mm: number | null;
  shots: number | null;
  ammo_lot: string | null;
  notes: string | null;
  client_id: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  display_name: string | null;
}

export interface RifleInput {
  name: string;
  muzzle_velocity_ms: number;
  bullet_weight_g: number;
  ballistic_coefficient: number;
  zero_range_m?: number;
  sight_height_mm?: number;
  click_value?: string;
  scope_unit?: ScopeUnit;
  trued_muzzle_velocity_ms?: number | null;
  notes?: string | null;
  is_default?: boolean;
}

export interface LocationInput {
  name: string;
  altitude_m?: number;
  lat?: number | null;
  lon?: number | null;
  notes?: string | null;
}

export interface DopeEntryInput {
  rifle_id: string;
  location_id?: string | null;
  shot_at?: string;
  distance_m: number;
  elevation_correction: number;
  windage_correction?: number;
  correction_unit?: ScopeUnit;
  wind_speed_ms?: number | null;
  wind_angle_deg?: number | null;
  temperature_c?: number | null;
  altitude_m?: number | null;
  pressure_hpa?: number | null;
  group_size_mm?: number | null;
  shots?: number | null;
  ammo_lot?: string | null;
  notes?: string | null;
  client_id?: string;
}
