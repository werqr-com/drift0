-- Drift0 accounts + DOPE logbook schema

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  unit_system text not null default 'imperial'
    check (unit_system in ('imperial', 'metric')),
  default_click_value text not null default '0.25moa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Rifles
create table public.rifles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  muzzle_velocity_ms double precision not null
    check (muzzle_velocity_ms > 0 and muzzle_velocity_ms <= 2000),
  bullet_weight_g double precision not null
    check (bullet_weight_g > 0 and bullet_weight_g <= 200),
  ballistic_coefficient double precision not null
    check (ballistic_coefficient > 0 and ballistic_coefficient <= 2),
  zero_range_m double precision not null default 91.44
    check (zero_range_m > 0 and zero_range_m <= 2000),
  sight_height_mm double precision not null default 38.1
    check (sight_height_mm >= 0 and sight_height_mm <= 500),
  click_value text not null default '0.25moa',
  scope_unit text not null default 'moa'
    check (scope_unit in ('moa', 'mil')),
  trued_muzzle_velocity_ms double precision
    check (trued_muzzle_velocity_ms is null or (trued_muzzle_velocity_ms > 0 and trued_muzzle_velocity_ms <= 2000)),
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rifles_user_id_idx on public.rifles (user_id);
create unique index rifles_one_default_per_user
  on public.rifles (user_id)
  where is_default = true;

alter table public.rifles enable row level security;

create policy "rifles_select_own"
  on public.rifles for select
  using (auth.uid() = user_id);

create policy "rifles_insert_own"
  on public.rifles for insert
  with check (auth.uid() = user_id);

create policy "rifles_update_own"
  on public.rifles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "rifles_delete_own"
  on public.rifles for delete
  using (auth.uid() = user_id);

create trigger rifles_set_updated_at
  before update on public.rifles
  for each row execute function public.set_updated_at();

-- Locations (named ranges)
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  altitude_m double precision not null default 0
    check (altitude_m >= -500 and altitude_m <= 10000),
  lat double precision
    check (lat is null or (lat >= -90 and lat <= 90)),
  lon double precision
    check (lon is null or (lon >= -180 and lon <= 180)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_user_id_idx on public.locations (user_id);

alter table public.locations enable row level security;

create policy "locations_select_own"
  on public.locations for select
  using (auth.uid() = user_id);

create policy "locations_insert_own"
  on public.locations for insert
  with check (auth.uid() = user_id);

create policy "locations_update_own"
  on public.locations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "locations_delete_own"
  on public.locations for delete
  using (auth.uid() = user_id);

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- DOPE entries
create table public.dope_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rifle_id uuid not null references public.rifles (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  shot_at timestamptz not null default now(),
  distance_m double precision not null
    check (distance_m > 0 and distance_m <= 5000),
  elevation_correction double precision not null default 0,
  windage_correction double precision not null default 0,
  correction_unit text not null default 'moa'
    check (correction_unit in ('moa', 'mil')),
  wind_speed_ms double precision
    check (wind_speed_ms is null or (wind_speed_ms >= 0 and wind_speed_ms <= 100)),
  wind_angle_deg double precision
    check (wind_angle_deg is null or (wind_angle_deg >= 0 and wind_angle_deg <= 360)),
  temperature_c double precision
    check (temperature_c is null or (temperature_c >= -50 and temperature_c <= 60)),
  altitude_m double precision
    check (altitude_m is null or (altitude_m >= -500 and altitude_m <= 10000)),
  pressure_hpa double precision
    check (pressure_hpa is null or (pressure_hpa >= 800 and pressure_hpa <= 1100)),
  group_size_mm double precision
    check (group_size_mm is null or group_size_mm >= 0),
  shots integer
    check (shots is null or (shots >= 1 and shots <= 100)),
  ammo_lot text,
  notes text,
  client_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index dope_entries_user_rifle_distance_idx
  on public.dope_entries (user_id, rifle_id, distance_m);
create index dope_entries_user_shot_at_idx
  on public.dope_entries (user_id, shot_at desc);

alter table public.dope_entries enable row level security;

create policy "dope_entries_select_own"
  on public.dope_entries for select
  using (auth.uid() = user_id);

create policy "dope_entries_insert_own"
  on public.dope_entries for insert
  with check (auth.uid() = user_id);

create policy "dope_entries_update_own"
  on public.dope_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "dope_entries_delete_own"
  on public.dope_entries for delete
  using (auth.uid() = user_id);

create trigger dope_entries_set_updated_at
  before update on public.dope_entries
  for each row execute function public.set_updated_at();
