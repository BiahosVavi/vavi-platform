-- Core: enums shared across phases, projects, tasks.

create type task_status as enum ('todo', 'in_progress', 'done', 'blocked');
create type task_priority as enum ('p1', 'p2', 'p3', 'p4');
create type entry_source as enum ('app', 'telegram');

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  color text,
  description text,
  context_md text,
  features jsonb not null default '{"pipeline": true, "money": true}',
  targets jsonb not null default '{}',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  priority task_priority not null default 'p3',
  is_urgent boolean not null default false,
  is_important boolean not null default false,
  status task_status not null default 'todo',
  due_date date,
  tags text[] not null default '{}',
  sort_order double precision not null default 0,
  completed_at timestamptz,
  source entry_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

create index tasks_project_status_idx on tasks (project_id, status);
create index tasks_due_open_idx on tasks (due_date) where status <> 'done';
create index tasks_tags_idx on tasks using gin (tags);

alter table projects enable row level security;
alter table tasks enable row level security;

create policy "authenticated full access" on projects
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on tasks
  for all to authenticated using (true) with check (true);
