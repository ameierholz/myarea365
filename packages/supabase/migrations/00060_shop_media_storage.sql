-- 00060: Storage-Bucket "shop-media" für Logo/Cover-Uploads durch Shop-Owner.
--
-- Statt URL-Feldern kann der Owner Bilder direkt hochladen. Bucket ist
-- öffentlich lesbar (damit das Logo auf der Karte ohne Auth geladen
-- werden kann), Schreib-Zugriff nur für den Owner des Shops.

-- ═══════════════════════════════════════════════════════
-- 1) Bucket anlegen
-- ═══════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-media',
  'shop-media',
  true,
  5 * 1024 * 1024,  -- 5 MB max
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ═══════════════════════════════════════════════════════
-- 2) Storage-RLS: Owner darf uploaden/überschreiben/löschen
--    für Ordner shop-media/{shop_id}/...
-- ═══════════════════════════════════════════════════════
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='shop_media_public_read'
  ) then
    create policy shop_media_public_read on storage.objects
      for select using (bucket_id = 'shop-media');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='shop_media_owner_insert'
  ) then
    create policy shop_media_owner_insert on storage.objects
      for insert with check (
        bucket_id = 'shop-media' and
        (storage.foldername(name))[1] in (
          select id::text from public.local_businesses where owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='shop_media_owner_update'
  ) then
    create policy shop_media_owner_update on storage.objects
      for update using (
        bucket_id = 'shop-media' and
        (storage.foldername(name))[1] in (
          select id::text from public.local_businesses where owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='shop_media_owner_delete'
  ) then
    create policy shop_media_owner_delete on storage.objects
      for delete using (
        bucket_id = 'shop-media' and
        (storage.foldername(name))[1] in (
          select id::text from public.local_businesses where owner_id = auth.uid()
        )
      );
  end if;
end $$;
