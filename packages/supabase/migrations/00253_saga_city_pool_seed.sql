-- 00253: Saga City-Pool Seed
--
-- Kuratierte Liste von Städten für die Metropol-Saga.
-- Größe (mini/mid/big/mega) matcht die Crew-Größen.
-- BBox-Werte aus OSM Nominatim recherchiert.

insert into public.saga_city_pool (slug, name, size_tier, bbox_south, bbox_west, bbox_north, bbox_east, apex_lat, apex_lng, apex_name, apex_emoji) values
  -- MINI (4 kleine Crews)
  ('cottbus',    'Cottbus',    'mini', 51.6700, 14.2700, 51.7900, 14.4900, 51.7607, 14.3328, 'Altmarkt Cottbus', '🏛'),
  ('goerlitz',   'Görlitz',    'mini', 51.1100, 14.9100, 51.1900, 15.0500, 51.1535, 14.9851, 'Untermarkt Görlitz', '🏛'),
  ('heilbronn',  'Heilbronn',  'mini', 49.0900, 9.1500, 49.1900, 9.3000, 49.1427, 9.2206, 'Marktplatz Heilbronn', '🏛'),
  ('trier',      'Trier',      'mini', 49.7000, 6.5800, 49.8100, 6.7500, 49.7596, 6.6441, 'Porta Nigra', '🏛'),
  -- MID (4-6 mittlere Crews)
  ('mannheim',   'Mannheim',   'mid', 49.4200, 8.4000, 49.5500, 8.5800, 49.4875, 8.4660, 'Wasserturm Mannheim', '🗼'),
  ('leipzig',    'Leipzig',    'mid', 51.2500, 12.2900, 51.4400, 12.4900, 51.3397, 12.3731, 'Augustusplatz Leipzig', '🏛'),
  ('bremen',     'Bremen',     'mid', 53.0200, 8.6500, 53.2200, 8.9000, 53.0793, 8.8017, 'Bremer Marktplatz', '🏛'),
  ('wiesbaden',  'Wiesbaden',  'mid', 50.0300, 8.1900, 50.1600, 8.3700, 50.0826, 8.2400, 'Kurhaus Wiesbaden', '🏛'),
  -- BIG (6 große Crews)
  ('koeln',      'Köln',       'big', 50.8300, 6.7700, 51.0900, 7.1600, 50.9413, 6.9583, 'Kölner Dom', '⛪'),
  ('frankfurt',  'Frankfurt',  'big', 50.0200, 8.4700, 50.2300, 8.8000, 50.1109, 8.6821, 'Römer Frankfurt', '🏛'),
  ('duesseldorf','Düsseldorf', 'big', 51.1300, 6.6900, 51.3500, 6.9400, 51.2254, 6.7763, 'Königsallee', '🏛'),
  ('stuttgart',  'Stuttgart',  'big', 48.6900, 9.0400, 48.8700, 9.3200, 48.7758, 9.1829, 'Schlossplatz Stuttgart', '🏛'),
  -- MEGA (8 sehr große Crews)
  ('berlin',     'Berlin',     'mega', 52.3300, 13.0900, 52.6800, 13.7700, 52.5163, 13.3777, 'Brandenburger Tor', '🏛'),
  ('muenchen',   'München',    'mega', 48.0500, 11.4000, 48.2500, 11.7300, 48.1374, 11.5755, 'Marienplatz München', '🏛'),
  ('hamburg',    'Hamburg',    'mega', 53.4000, 9.7300, 53.7000, 10.3300, 53.5511, 9.9937, 'Rathaus Hamburg', '🏛')
on conflict (slug) do nothing;
