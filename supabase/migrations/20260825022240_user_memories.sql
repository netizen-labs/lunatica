create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_message_id uuid references public.messages(id) on delete set null,
  summary text not null,
  category text not null default 'personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_summary_length check (char_length(summary) between 3 and 300),
  constraint memories_category_valid check (category in ('identity', 'education', 'work', 'preference', 'personal', 'custom'))
);

create unique index memories_user_summary_unique_idx
on public.memories (user_id, lower(summary));

create index memories_user_updated_idx
on public.memories (user_id, updated_at desc);

create index memories_source_message_idx
on public.memories (source_message_id)
where source_message_id is not null;

alter table public.memories enable row level security;

revoke all on table public.memories from anon, authenticated;
grant select, delete on table public.memories to authenticated;

create policy "memories_select_own"
on public.memories for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "memories_delete_own"
on public.memories for delete
to authenticated
using ((select auth.uid()) = user_id);
