-- Material-Grafiken: Admin darf eigene Bilder pro Material-Typ hochladen.
-- Folgt demselben Muster wie guardian_archetypes/item_catalog:
-- image_url liegt direkt auf dem Katalog-Eintrag, Upload geht in den
-- existierenden artwork-Bucket unter materials/{id}.{ext}.

alter table public.material_catalog
  add column if not exists image_url text,
  add column if not exists video_url text;

comment on column public.material_catalog.image_url is
  'Admin-upload: Material-Icon (PNG mit Alpha, 1024x1024). Fallback: emoji.';
comment on column public.material_catalog.video_url is
  'Admin-upload: animiertes Material-Icon (WebM/MP4, seamless loop).';
