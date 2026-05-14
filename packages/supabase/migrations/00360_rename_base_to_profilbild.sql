-- ════════════════════════════════════════════════════════════════════
-- UI-Icon-Slot 'quick_base' umbenennen: "Eigene Base" → "Profilbild"
-- Slot-ID bleibt 'quick_base' (Frontend referenziert sie überall),
-- nur Label/Description ändern sich. Karten-HUD-Profil-Avatar nutzt
-- dieses Artwork als Profilbild (siehe karten-hud.tsx).
-- ════════════════════════════════════════════════════════════════════

update public.ui_icon_slots
set name = 'Quickzugriff: Profilbild',
    description = 'Profilbild des Spielers — wird im Karten-HUD oben links und in der Quickzugriff-Bar rechts unten gezeigt',
    fallback_emoji = '👤'
where id = 'quick_base';
