-- Metrics: definitions + entries, pipeline events, money entries, report snapshots.

create type pipeline_event_type as enum ('lead_added', 'proposal_sent', 'deal_won', 'deal_lost');
create type money_type as enum ('revenue', 'expense');
create type metric_aggregation as enum ('sum', 'last');

create table metric_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key text not null,
  name text not null,
  unit text,
  aggregation metric_aggregation not null default 'sum',
  weekly_target numeric,
  quick_increment numeric default 1,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, key)
);

create table metric_entries (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references metric_definitions(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  value numeric not null,
  note text,
  -- Always set from app code using Africa/Casablanca local date (lib/time.ts).
  entry_date date not null,
  source entry_source not null default 'app',
  created_at timestamptz not null default now()
);

create index metric_entries_project_date_idx on metric_entries (project_id, entry_date);
create index metric_entries_metric_date_idx on metric_entries (metric_id, entry_date);

create table pipeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type pipeline_event_type not null,
  contact text,
  value_mad numeric,
  note text,
  event_date date not null,
  source entry_source not null default 'app',
  created_at timestamptz not null default now()
);

create index pipeline_events_project_date_idx on pipeline_events (project_id, event_date);
create index pipeline_events_project_type_idx on pipeline_events (project_id, type);

create table money_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type money_type not null,
  amount_mad numeric not null check (amount_mad > 0),
  category text,
  note text,
  entry_date date not null,
  source entry_source not null default 'app',
  created_at timestamptz not null default now()
);

create index money_entries_project_date_idx on money_entries (project_id, entry_date);

create table report_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_start date unique not null,
  payload jsonb not null,
  overall_score numeric,
  created_at timestamptz not null default now()
);

alter table metric_definitions enable row level security;
alter table metric_entries enable row level security;
alter table pipeline_events enable row level security;
alter table money_entries enable row level security;
alter table report_snapshots enable row level security;

create policy "authenticated full access" on metric_definitions
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on metric_entries
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on pipeline_events
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on money_entries
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on report_snapshots
  for all to authenticated using (true) with check (true);
