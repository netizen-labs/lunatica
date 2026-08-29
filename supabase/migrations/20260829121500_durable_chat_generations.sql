create table public.chat_generations (
  id uuid primary key,
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_message_id uuid not null,
  status text not null default 'generating',
  cancel_requested boolean not null default false,
  assistant_message_id uuid,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_generations_status_valid check (status in ('generating', 'completed', 'failed', 'cancelled')),
  constraint chat_generations_error_code_length check (error_code is null or char_length(error_code) <= 80),
  constraint chat_generations_conversation_owner_fk foreign key (conversation_id, user_id)
    references public.conversations(id, user_id) on delete cascade,
  constraint chat_generations_user_message_owner_fk foreign key (user_message_id, user_id)
    references public.messages(id, user_id) on delete cascade,
  constraint chat_generations_assistant_message_fk foreign key (assistant_message_id)
    references public.messages(id) on delete set null
);

create index chat_generations_user_status_updated_idx
on public.chat_generations (user_id, status, updated_at desc);

create index chat_generations_conversation_updated_idx
on public.chat_generations (conversation_id, updated_at desc);

create index chat_generations_conversation_owner_idx
on public.chat_generations (conversation_id, user_id);

create index chat_generations_user_message_owner_idx
on public.chat_generations (user_message_id, user_id);

create index chat_generations_assistant_message_idx
on public.chat_generations (assistant_message_id)
where assistant_message_id is not null;

alter table public.chat_generations enable row level security;

revoke all on table public.chat_generations from anon, authenticated;
grant select on table public.chat_generations to authenticated;

create policy "chat_generations_select_own"
on public.chat_generations for select
to authenticated
using ((select auth.uid()) = user_id);

create trigger chat_generations_set_updated_at
before update on public.chat_generations
for each row execute function private.set_updated_at();

revoke all on function private.set_updated_at() from public, anon, authenticated;
