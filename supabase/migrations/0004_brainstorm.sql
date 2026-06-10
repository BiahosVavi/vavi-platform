-- Brainstorm spaces: notes, idea pipeline, links, AI research conversations.

create type idea_stage as enum ('raw', 'evaluating', 'validated', 'executing', 'archived');

create table notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  content_md text not null default '',
  pinned boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notes_updated_at before update on notes
  for each row execute function set_updated_at();

create index notes_project_updated_idx on notes (project_id, updated_at desc);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  stage idea_stage not null default 'raw',
  impact smallint check (impact between 1 and 5),
  effort smallint check (effort between 1 and 5),
  converted_task_id uuid references tasks(id) on delete set null,
  sort_order double precision not null default 0,
  source entry_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ideas_updated_at before update on ideas
  for each row execute function set_updated_at();

create index ideas_project_stage_idx on ideas (project_id, stage);

create table links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  url text not null,
  title text,
  description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index links_tags_idx on links using gin (tags);

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ai_conversations_updated_at before update on ai_conversations
  for each row execute function set_updated_at();

-- UIMessage ids from the AI SDK are strings (not uuids) — keep them as-is
-- for lossless round-trips with useChat.
create table ai_messages (
  id text primary key,
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_idx on ai_messages (conversation_id, created_at);

alter table notes enable row level security;
alter table ideas enable row level security;
alter table links enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;

create policy "authenticated full access" on notes
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on ideas
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on links
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on ai_conversations
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on ai_messages
  for all to authenticated using (true) with check (true);
