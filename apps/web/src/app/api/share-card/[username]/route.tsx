/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const WIDTH = 1080;
const HEIGHT = 1920;

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const sb = await createClient();
  const { data: user } = await sb
    .from("v_public_profiles")
    .select("username, display_name, faction, total_distance_m, total_walks, total_xp, level")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const km = ((user.total_distance_m ?? 0) / 1000).toFixed(1);
  const accent = user.faction === "syndicate" ? "#22D1C3" : user.faction === "vanguard" ? "#FF6B4A" : "#22D1C3";
  const factionLabel = user.faction === "syndicate" ? "🌙 Nachtpuls" : user.faction === "vanguard" ? "☀️ Sonnenwacht" : "🏃";
  const url = new URL(req.url);
  const refCode = url.searchParams.get("ref");
  const cta = refCode ? `myarea365.de/?ref=${refCode}` : "myarea365.de";

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH, height: HEIGHT,
          display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg, #0F1115 0%, #1a3d6e 100%)",
          color: "#F0F0F0",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 80,
          position: "relative",
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 900,
          background: `radial-gradient(ellipse at 50% 10%, ${accent}55 0%, transparent 60%)`,
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 60 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 40,
            background: `linear-gradient(135deg, ${accent}, #FF2D78)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40,
          }}>🏃</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#FFF", letterSpacing: 1 }}>MyArea365</div>
            <div style={{ fontSize: 20, color: "#a8b4cf" }}>Erobere deine Stadt</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginTop: 40 }}>
          <div style={{ fontSize: 36, color: "#a8b4cf", fontWeight: 800, letterSpacing: 2 }}>{factionLabel}</div>
          <div style={{ fontSize: 96, fontWeight: 900, color: "#FFF", lineHeight: 1.05, marginTop: 10 }}>
            {user.display_name ?? user.username}
          </div>
          <div style={{ fontSize: 32, color: accent, fontWeight: 800, marginTop: 10 }}>@{user.username}</div>
        </div>

        <div style={{
          display: "flex", gap: 24, marginTop: 100, padding: 40, borderRadius: 32,
          background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.12)",
        }}>
          <Stat label="km gelaufen" value={km} accent={accent} />
          <Stat label="Läufe" value={String(user.total_walks ?? 0)} accent="#FFD700" />
          <Stat label="Level" value={String(user.level ?? 1)} accent="#FF2D78" />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: 40, borderRadius: 32,
          background: `linear-gradient(135deg, ${accent}22, #FF2D7822)`,
          border: `3px solid ${accent}88`,
        }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#FFF", textAlign: "center" }}>Lauf mit mir 🏃</div>
          <div style={{ fontSize: 28, color: "#a8b4cf", marginTop: 16 }}>{cta}</div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: 72, fontWeight: 900, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 22, color: "#dde3f5", fontWeight: 700, marginTop: 8, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
