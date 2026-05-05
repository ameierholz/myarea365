# Sprite-Sheet-Pipeline für 3D-Begleiter auf der Karte

Diese Pipeline rendert offline aus glTF/GLB-Modellen 8-Richtungs-Sprite-Sheets,
die zur Laufzeit als Mapbox-Symbol-Layer für hunderte gleichzeitige Spieler-Marches
genutzt werden (Phase 3a).

**Warum Sprites statt Echt-3D auf der Karte?** Browser-WebGL kann ~10-15 animierte
3D-Chars gleichzeitig in akzeptabler Performance darstellen. RoK/CoD nutzen
für 100+ Spieler auf der Map ebenfalls vorgerenderte Sprites — nur der Hero im
Detail-Modal ist Echt-3D. Diese Pipeline macht das Gleiche.

---

## Voraussetzungen (einmalig)

1. **Blender installieren** (gratis, Open Source) — https://www.blender.org/download/
   - Empfohlen: Blender 4.2 LTS
   - Standard-Installationspfad: `C:\Program Files\Blender Foundation\Blender 4.2\`
2. **pnpm install** (sharp ist bereits in den dev-deps)

---

## Render-Workflow

### Schritt 1: Frames rendern (Blender)

```bash
"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" \
  --background \
  --python scripts/sprites/render_sprites.py -- \
  --char-id lorekeeper \
  --character apps/web/public/3d/lorekeeper/character.glb \
  --animations apps/web/public/3d/lorekeeper/anim_general.glb \
  --animations apps/web/public/3d/lorekeeper/anim_movement.glb \
  --actions Idle_A:idle:1,Walking_A:walk:16,Running_A:run:14,Hit_A:hit:8,Throw:attack:12 \
  --directions 8 \
  --size 128
```

Optionen:
- `--char-id` — Output-Ordnername (z.B. `lorekeeper`, `knight`, `skeleton`)
- `--character` — Pfad zur GLB des 3D-Modells
- `--animations` — eine oder mehrere Animation-Pack-GLBs (mehrfach verwendbar)
- `--actions` — kommagetrennte Liste `CLIP_NAME:tag:framecount`
  - `CLIP_NAME` = exakter Animation-Name aus dem GLB
  - `tag` = unser Kurzname (idle, walk, run, attack, …)
  - `framecount` = wieviele Frames sollen aus der Animation gesampled werden (mehr = smoother, größer)
- `--directions` — Anzahl Yaw-Rotationen (Default 8)
- `--size` — Pixel pro Frame, quadratisch (Default 128)
- `--camera-pitch` — Kamera-Pitch in Grad (Default 55, top-down)

Output landet in `scripts/sprites/_out/<char_id>/<tag>/dir<N>_frame<NNN>.png`.

### Schritt 2: PNG-Sequenzen zu Sprite-Atlas packen (Node)

```bash
pnpm tsx scripts/sprites/build_atlas.mjs lorekeeper
```

Erzeugt:
```
apps/web/public/sprites/lorekeeper/
  idle.png    + idle.json
  walk.png    + walk.json
  run.png     + run.json
  attack.png  + attack.json
```

Layout pro Atlas: `directions × frames` Grid (8 Zeilen, N Spalten).
`*.json` enthält `cell_w`, `cell_h`, `directions`, `frames`, `atlas_w`, `atlas_h` für den Renderer.

### Schritt 3 (optional): PNG zusätzlich quetschen

Falls `pngquant` installiert ist (Chocolatey: `choco install pngquant`), reduziert
build_atlas.mjs die Atlas-PNGs automatisch um 60–80%.

---

## Beispiel — Lorekeeper-Komplettrendering

Tatsächlich verfügbare Clips in den mitgelieferten Anim-Packs (per GLB-Header verifiziert):

```
Idle_A, Idle_B
Walking_A, Walking_B, Walking_C
Running_A, Running_B
Jump_Idle, Jump_Full_Long, Jump_Full_Short, Jump_Land, Jump_Start
Hit_A, Hit_B
Throw, Interact, PickUp, Use_Item
Spawn_Ground, Spawn_Air
Death_A, Death_B
```

Empfohlene Action-Spec für die Map (5 Aktionen, ~70 Frames pro Richtung × 8 Richtungen ≈ 560 Frames):

```
Idle_A:idle:1,Walking_A:walk:16,Running_A:run:14,Throw:attack:12,Hit_A:hit:8
```

Erwartete Atlas-Größen (128×128 pro Frame, 8 Richtungen, mit pngquant):
- idle.png: 1×8 → ~30 KB
- walk.png: 16×8 → ~280 KB
- run.png: 14×8 → ~250 KB
- attack.png: 12×8 → ~210 KB
- hit.png: 8×8 → ~140 KB
- **Total ≈ 900 KB pro Begleiter** — bei 20 Begleitern ≈ 18 MB Sprites total.

---

## Neue Begleiter hinzufügen

Pro neuem Char:
1. Asset (GLB) in `apps/web/public/3d/<char_id>/character.glb` ablegen
2. Animation-Packs (falls separat) ebenfalls dort
3. GLB-Header inspizieren um Clip-Namen zu sehen:
   ```bash
   node -e "const fs=require('fs');const buf=fs.readFileSync('PATH.glb');const len=buf.readUInt32LE(12);const j=JSON.parse(buf.slice(20,20+len).toString());console.log(j.animations?.map(a=>a.name))"
   ```
4. Render-Command anpassen (`--char-id`, `--character`, `--animations`, `--actions`)
5. Atlas-Builder ausführen
6. Phase-3-Renderer auf der Karte erkennt den neuen Char automatisch (slot-basierte Dateinamen)

---

## Troubleshooting

**"action not found" beim Rendern** — Clip-Name stimmt nicht. GLB-Header inspizieren (siehe oben).

**Frames sehen falsch beleuchtet aus** — `--camera-pitch` anpassen (50–60° passt für die meisten Map-Views).
Bei Bedarf Light-Setup im Python-Script tunen (`render_sprites.py`, "Lighting"-Block).

**Atlas zu groß** — `--size` reduzieren (96 statt 128) oder `--directions 4` statt 8 (Smoothness vs. Disk-Tradeoff).

**pnpm tsx fehlt** — `pnpm add -D -w tsx` oder mit `node` ersetzen (`build_atlas.mjs` nutzt nur Standard-ES-Modules + sharp).
