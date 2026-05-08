-- get_inbox_messages liefert ab jetzt auch from_locale (für 🌐-Button im Inbox-UI)

create or replace function public.get_inbox_messages(
  p_category text,
  p_subcategory text default null,
  p_only_unread boolean default false,
  p_starred_only boolean default false,
  p_limit int default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select i.id, i.title, i.body, i.read_at, i.created_at,
             i.category, i.subcategory, i.kind, i.payload,
             i.is_starred, i.from_user_id, i.from_label,
             i.reward_payload, i.claimed_at,
             coalesce(u.display_name, u.username, i.from_label, 'System') as from_name,
             u.avatar_url as from_avatar,
             coalesce(u.setting_language, u.email_locale) as from_locale
        from public.user_inbox i
        left join public.users u on u.id = i.from_user_id
       where i.user_id = v_user
         and i.deleted_at is null
         and i.category = p_category
         and (p_subcategory is null or i.subcategory = p_subcategory)
         and (not p_only_unread or i.read_at is null)
         and (not p_starred_only or i.is_starred = true)
       order by i.created_at desc
       limit greatest(1, least(500, p_limit))
    ) r;

  return v_rows;
end $$;
