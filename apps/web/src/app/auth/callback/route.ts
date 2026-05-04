import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Whitelist-Validator gegen Open-Redirect.
 * Akzeptiert nur same-origin relative Pfade (führendes "/", aber nicht "//"
 * oder "/\\" das von Browsern als Schemewechsel interpretiert wird).
 * Verhindert ?next=//evil.com oder ?next=/\\evil.com Angriffe.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  // Nur Pfade die mit genau einem "/" anfangen, gefolgt von keinem Slash/Backslash.
  if (!/^\/(?![/\\])/.test(raw)) return "/dashboard";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("username, faction")
          .eq("id", user.id)
          .maybeSingle();
        if (!profile || !profile.faction || !profile.username) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
