create index message_attachments_message_owner_idx
on public.message_attachments (message_id, user_id);

create index message_attachments_conversation_owner_idx
on public.message_attachments (conversation_id, user_id);
