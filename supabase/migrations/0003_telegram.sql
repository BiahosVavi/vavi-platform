-- Telegram quick-add inbox, cron idempotency, app settings.

create type inbox_action as enum ('create_task', 'log_pipeline', 'log_money', 'log_metric', 'capture_idea', 'unknown');
create type inbox_status as enum ('received', 'pending_confirm', 'applied', 'cancelled', 'undone', 'failed');
create type cron_job as enum ('morning', 'evening');

create table telegram_inbox (
  id uuid primary key default gen_random_uuid(),
  telegram_update_id bigint unique not null,
  chat_id bigint,
  message_id bigint,
  raw_text text,
  action inbox_action,
  parsed jsonb,
  status inbox_status not null default 'received',
  result_table text,
  result_id uuid,
  bot_message_id bigint,
  error text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index telegram_inbox_status_idx on telegram_inbox (status);
create index telegram_inbox_created_idx on telegram_inbox (created_at desc);

create table cron_runs (
  id uuid primary key default gen_random_uuid(),
  job cron_job not null,
  local_date date not null,
  status text not null default 'pending', -- pending | sent | error | skipped
  detail text,
  created_at timestamptz not null default now(),
  unique (job, local_date)
);

create table app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

alter table telegram_inbox enable row level security;
alter table cron_runs enable row level security;
alter table app_settings enable row level security;

create policy "authenticated full access" on telegram_inbox
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on cron_runs
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on app_settings
  for all to authenticated using (true) with check (true);
