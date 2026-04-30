-- ══════════════════════════════════════════════════════════════════════════
-- Crew-Kürzel: max 4 Zeichen (statt 5)
-- ══════════════════════════════════════════════════════════════════════════

-- Bestehende 5-Zeichen-Tags auf 4 kürzen
update public.crews
   set tag = left(tag, 4)
 where tag is not null and char_length(tag) > 4;

-- Constraint aktualisieren: 2-4 Zeichen
alter table public.crews drop constraint if exists crews_tag_format_check;
alter table public.crews
  add constraint crews_tag_format_check
  check (tag is null or (char_length(tag) between 2 and 4 and tag ~ '^[A-Z0-9]+$'));

-- Auto-Tag-Trigger anpassen: erste 4 statt 5 Alphanumerics
create or replace function public.crews_autotag()
returns trigger language plpgsql as $$
begin
  if new.tag is null or new.tag = '' then
    new.tag := upper(left(regexp_replace(coalesce(new.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4));
  end if;
  return new;
end $$;
