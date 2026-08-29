alter table public.conversations
  add column is_pinned boolean not null default false,
  add column is_temporary boolean not null default false,
  add column expires_at timestamptz;

alter table public.conversations
  add constraint conversations_temporary_expiry check (
    (is_temporary = true and expires_at is not null)
    or (is_temporary = false and expires_at is null)
  );

create index conversations_user_pinned_updated_idx
on public.conversations (user_id, is_pinned desc, updated_at desc)
where is_temporary = false;

create index conversations_temporary_expiry_idx
on public.conversations (expires_at)
where is_temporary = true;

alter table public.message_attachments
  drop constraint message_attachments_mime;

alter table public.message_attachments
  add constraint message_attachments_mime check (mime_type in (
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'image/avif',
    'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json'
  ));

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/avif',
  'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json'
]
where id = 'attachments';
