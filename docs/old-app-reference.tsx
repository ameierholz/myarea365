// ============================================
// REFERENZ: Alter Expo/React Native Code
// Gespeichert am 15.04.2026 als Nachbau-Vorlage
// NICHT für den Build – nur als Dokumentation
// ============================================

// FEATURES DIE NOCH EINGEBAUT WERDEN MÜSSEN:
// 1. Reverse Geocoding (aktuelle Straße live anzeigen)
// 2. Eroberte Territorien speichern + auf Karte anzeigen
// 3. XP-Vergabe nach Walk (+500 XP pro Eroberung)
// 4. Rang-System (Straßen-Scout → Metropolen-Legende)
// 5. Fraktions-System (Syndicate vs Vanguard, Power-Bar)
// 6. Team gründen (Name, PLZ, Farbe)
// 7. Team-Mitglieder verwalten (Admin/Kick)
// 8. Leaderboard aus Supabase (Top 10 nach XP)
// 9. Andere Runner auf der Karte
// 10. Gesundheitsdaten (KM, Kalorien)
// 11. Rewarded Ads (+250 XP)
// 12. Live Status (aktuelle Straße im Profil)
// 13. Mindestlänge für Eroberung (>2 Punkte)
// 14. "Eroberung starten/abschließen" statt "Walk starten"

// RUNNER RANKS:
// { name: 'Straßen-Scout', minXp: 0, color: '#888888' }
// { name: 'Stadt-Pionier', minXp: 500, color: '#5ddaf0' }
// { name: 'Viertel-Boss', minXp: 2500, color: '#ef7169' }
// { name: 'Metropolen-Legende', minXp: 10000, color: '#FFD700' }

// UNLOCKABLE MARKERS:
// 👣 Basic (0), 🏃‍♂️ Athlet (500), 🛹 Skater (2000)
// 🚴 Biker (5000), 🚀 Rakete (10000), 🛸 Alien (25000)

// FACTIONS:
// Syndicate (Cyan #5ddaf0, 12500 Power)
// Vanguard (Coral #ef7169, 14200 Power)

// TEAM COLORS: #5ddaf0, #ef7169, #FFD700, #a855f7

// DB TABLES (alt):
// profiles: id, username, xp, team_color, total_km, total_calories
// territories: user_id, path (coordinates)
