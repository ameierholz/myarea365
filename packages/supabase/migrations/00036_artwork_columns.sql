-- 00036: Artwork-Spalten sicherstellen (image_url, video_url)
-- Wenn sie fehlen, schlägt das Finalize im Artwork-Generator stumm fehl.

alter table public.guardian_archetypes add column if not exists image_url text;
alter table public.guardian_archetypes add column if not exists video_url text;

alter table public.item_catalog add column if not exists image_url text;
