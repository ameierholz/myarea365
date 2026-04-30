-- ══════════════════════════════════════════════════════════════════════════
-- Crew-Tag: muss exakt 4 Zeichen sein (statt 2-4)
-- Bestehende kürzere Tags werden mit "0" auf 4 Zeichen aufgefüllt.
-- ══════════════════════════════════════════════════════════════════════════

update public.crews
   set tag = tag || repeat('0', 4 - char_length(tag))
 where tag is not null and char_length(tag) < 4;

alter table public.crews drop constraint if exists crews_tag_format_check;
alter table public.crews
  add constraint crews_tag_format_check
  check (tag is null or (char_length(tag) = 4 and tag ~ '^[A-Z0-9]+$'));

-- Auto-Tag-Trigger: produziert immer 4 Zeichen (mit "0" gepaddet falls Name zu kurz)
create or replace function public.crews_autotag()
returns trigger language plpgsql as $$
declare v_clean text;
begin
  if new.tag is null or new.tag = '' then
    v_clean := upper(left(regexp_replace(coalesce(new.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4));
    if char_length(v_clean) < 4 then
      v_clean := v_clean || repeat('0', 4 - char_length(v_clean));
    end if;
    new.tag := v_clean;
  end if;
  return new;
end $$;
