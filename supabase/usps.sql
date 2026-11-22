begin;

create schema usps_private;
revoke all on schema usps_private from public, anon;
grant usage on schema usps_private to authenticated;

create table if not exists public.usps_members (
  id uuid primary key references auth.users(id) on delete restrict,
  mailbox_slot smallint not null unique check (mailbox_slot in (1, 2)),
  display_name text not null check (length(display_name) between 1 and 60)
);

create table if not exists public.usps_letters (
  id uuid primary key,
  sender_id uuid not null references public.usps_members(id),
  recipient_id uuid not null references public.usps_members(id),
  format text not null check (format in ('postcard', 'envelope', 'telegram')),
  draft jsonb not null check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 3600000),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  check (sender_id <> recipient_id)
);

create table if not exists public.usps_deliveries (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.usps_letters(id) on delete restrict,
  delivered_at timestamptz not null default now(),
  opened_at timestamptz,
  filed_at timestamptz,
  check (filed_at is null or opened_at is not null)
);

create index if not exists usps_letters_sender on public.usps_letters(sender_id, updated_at desc);
create index if not exists usps_letters_recipient on public.usps_letters(recipient_id, sent_at desc);
create index if not exists usps_deliveries_letter on public.usps_deliveries(letter_id, delivered_at desc);
create unique index if not exists usps_one_unread_delivery
  on public.usps_deliveries(letter_id) where opened_at is null;

alter table public.usps_members enable row level security;
alter table public.usps_letters enable row level security;
alter table public.usps_deliveries enable row level security;
revoke all on public.usps_members, public.usps_letters, public.usps_deliveries from anon, authenticated;
grant select on public.usps_members, public.usps_letters, public.usps_deliveries to authenticated;

create policy usps_member_is_self on public.usps_members for select to authenticated
  using (id = (select auth.uid()));

create policy usps_letter_participants on public.usps_letters for select to authenticated
  using (sender_id = (select auth.uid()) or (recipient_id = (select auth.uid()) and sent_at is not null));

create policy usps_delivery_participants on public.usps_deliveries for select to authenticated
  using (exists (
    select 1 from public.usps_letters l where l.id = usps_deliveries.letter_id
      and (l.sender_id = (select auth.uid())
        or (l.recipient_id = (select auth.uid()) and l.sent_at is not null))
  ));

create or replace function usps_private.usps_mailbox()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  member uuid := auth.uid();
  own record;
  other record;
begin
  select id, display_name into own from public.usps_members where id = member;
  if not found then raise insufficient_privilege using message = 'This mailbox is invitation only'; end if;
  select id, display_name into strict other from public.usps_members where id <> member;
  return jsonb_build_object(
    'me', own.display_name,
    'recipient', other.display_name,
    'letters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'format', l.format, 'sent', l.sent_at, 'updated', l.updated_at,
        'unread', exists(select 1 from public.usps_deliveries d where d.letter_id=l.id and d.opened_at is null)
      ) order by l.updated_at desc)
      from public.usps_letters l where l.sender_id = member
    ), '[]'::jsonb),
    'deliveries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'letter', l.id, 'format', l.format,
        'delivered', d.delivered_at, 'opened', d.opened_at, 'filed', d.filed_at
      ) order by d.delivered_at desc)
      from public.usps_deliveries d join public.usps_letters l on l.id=d.letter_id
      where l.recipient_id=member and l.sent_at is not null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function usps_private.usps_save_draft(p_id uuid, p_draft jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  member uuid := auth.uid();
  other uuid;
begin
  if not exists(select 1 from public.usps_members where id=member) then raise insufficient_privilege; end if;
  select id into strict other from public.usps_members where id<>member;
  insert into public.usps_letters(id,sender_id,recipient_id,format,draft)
    values(p_id,member,other,p_draft->>'format',p_draft)
  on conflict (id) do update
    set format=excluded.format,draft=excluded.draft,updated_at=now()
    where usps_letters.sender_id=member and usps_letters.sent_at is null;
  if not found then raise insufficient_privilege using message = 'Only the sender can edit an unsent draft'; end if;
end;
$$;

create or replace function usps_private.usps_deliver(p_id uuid, p_again boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  item public.usps_letters%rowtype;
begin
  select * into item from public.usps_letters where id=p_id and sender_id=auth.uid() for update;
  if not found then raise insufficient_privilege; end if;
  if p_again and item.sent_at is null then raise insufficient_privilege; end if;
  if not p_again and item.sent_at is not null then return; end if;
  if item.sent_at is null then
    update public.usps_letters set sent_at=now(),updated_at=now() where id=p_id;
  end if;
  insert into public.usps_deliveries(letter_id) values(p_id)
    on conflict (letter_id) where opened_at is null do nothing;
end;
$$;

create or replace function usps_private.usps_receive(p_id uuid, p_file boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.usps_deliveries d
  set opened_at=coalesce(d.opened_at,now()),
      filed_at=case when p_file then coalesce(d.filed_at,now()) else d.filed_at end
  from public.usps_letters l
  where d.letter_id=l.id and d.id=p_id and l.recipient_id=auth.uid() and l.sent_at is not null;
  if not found then raise insufficient_privilege; end if;
end;
$$;

create or replace function usps_private.usps_send(p_id uuid, p_draft jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  if exists(select 1 from public.usps_letters
    where id=p_id and sender_id=auth.uid() and sent_at is not null) then return; end if;
  perform usps_private.usps_save_draft(p_id,p_draft);
  perform usps_private.usps_deliver(p_id,false);
end;
$$;

create function public.usps_mailbox() returns jsonb language sql stable security invoker set search_path = '' as $$ select usps_private.usps_mailbox() $$;
create function public.usps_save_draft(p_id uuid, p_draft jsonb) returns void language sql security invoker set search_path = '' as $$ select usps_private.usps_save_draft(p_id,p_draft) $$;
create function public.usps_deliver(p_id uuid, p_again boolean) returns void language sql security invoker set search_path = '' as $$ select usps_private.usps_deliver(p_id,p_again) $$;
create function public.usps_receive(p_id uuid, p_file boolean) returns void language sql security invoker set search_path = '' as $$ select usps_private.usps_receive(p_id,p_file) $$;
create function public.usps_send(p_id uuid, p_draft jsonb) returns void language sql security invoker set search_path = '' as $$ select usps_private.usps_send(p_id,p_draft) $$;

revoke all on function usps_private.usps_mailbox(), usps_private.usps_save_draft(uuid,jsonb),
  usps_private.usps_deliver(uuid,boolean), usps_private.usps_receive(uuid,boolean),
  usps_private.usps_send(uuid,jsonb) from public, anon;
grant execute on function usps_private.usps_mailbox(), usps_private.usps_save_draft(uuid,jsonb),
  usps_private.usps_deliver(uuid,boolean), usps_private.usps_receive(uuid,boolean),
  usps_private.usps_send(uuid,jsonb) to authenticated;

revoke all on function public.usps_mailbox(), public.usps_save_draft(uuid,jsonb),
  public.usps_deliver(uuid,boolean), public.usps_receive(uuid,boolean),
  public.usps_send(uuid,jsonb) from public, anon;
grant execute on function public.usps_mailbox(), public.usps_save_draft(uuid,jsonb),
  public.usps_deliver(uuid,boolean), public.usps_receive(uuid,boolean),
  public.usps_send(uuid,jsonb) to authenticated;

commit;
