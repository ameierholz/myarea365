-- 00228_survey_reward.sql
-- Umfragen mit One-Shot Belohnung pro User.

create table if not exists public.surveys (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  reward_payload  jsonb not null default '{}'::jsonb,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.user_survey_completions (
  user_id        uuid not null references public.users(id) on delete cascade,
  survey_id      uuid not null references public.surveys(id) on delete cascade,
  completed_at   timestamptz not null default now(),
  response       jsonb not null default '{}'::jsonb,
  primary key (user_id, survey_id)
);

alter table public.surveys enable row level security;
alter table public.user_survey_completions enable row level security;
drop policy if exists "surveys_read_active" on public.surveys;
create policy "surveys_read_active" on public.surveys for select using (active);
drop policy if exists "survey_completions_self" on public.user_survey_completions;
create policy "survey_completions_self" on public.user_survey_completions for select using (user_id = auth.uid());

create or replace function public.complete_survey(p_survey_id uuid, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_gems int; v_items jsonb; v_item jsonb;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  select * into v_survey from public.surveys where id=p_survey_id and active=true;
  if not found then raise exception 'survey_not_found_or_inactive'; end if;
  begin
    insert into public.user_survey_completions (user_id, survey_id, response)
    values (v_uid, p_survey_id, coalesce(p_response, '{}'::jsonb));
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_completed');
  end;
  v_gems := coalesce((v_survey.reward_payload->>'gems')::int, 0);
  if v_gems > 0 then
    insert into public.user_gems (user_id, gems) values (v_uid, v_gems)
    on conflict (user_id) do update set gems = user_gems.gems + v_gems, updated_at = now();
    insert into public.gem_transactions (user_id, delta, reason, metadata)
    values (v_uid, v_gems, 'survey', jsonb_build_object('survey_id', p_survey_id));
  end if;
  v_items := coalesce(v_survey.reward_payload->'items', '[]'::jsonb);
  for v_item in select * from jsonb_array_elements(v_items) loop
    perform public.grant_inventory_item(v_uid, v_item->>'catalog_id', coalesce((v_item->>'count')::int, 1));
  end loop;
  insert into public.user_inbox (user_id, title, body, category, kind, payload, reward_payload, from_label)
  values (v_uid, 'Danke für deine Teilnahme!', v_survey.title, 'reward', 'survey', v_survey.reward_payload, v_survey.reward_payload, 'System');
  return jsonb_build_object('ok', true, 'reward', v_survey.reward_payload);
end; $$;

revoke all on function public.complete_survey(uuid, jsonb) from public;
grant execute on function public.complete_survey(uuid, jsonb) to authenticated;
