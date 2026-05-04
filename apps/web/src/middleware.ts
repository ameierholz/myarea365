import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/csrf";

const PUBLIC_ROUTES = ["/", "/login", "/registrieren", "/registrierung-bestaetigen", "/onboarding", "/datenschutz", "/privacy", "/impressum", "/agb", "/terms", "/shop-dashboard", "/unsubscribe", "/leaderboard", "/pricing"];
const PUBLIC_PREFIXES = ["/u/", "/crew/", "/api/share-card/"];

// API-Pfade die CSRF-frei sind: Stripe-Webhook (eigene Signatur), Cron (CRON_SECRET).
const CSRF_SKIP_PREFIXES = ["/api/stripe/webhook", "/api/cron/", "/api/health"];

export async function middleware(request: NextRequest) {
  const pathname0 = request.nextUrl.pathname;
  if (pathname0.startsWith("/api")) {
    if (!CSRF_SKIP_PREFIXES.some((p) => pathname0.startsWith(p))) {
      const bad = assertSameOrigin(request);
      if (bad) return bad;
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname.replace(/\/$/, "") || "/";

  // Redirect logged-in users away from login/register
  if (user && (pathname === "/login" || pathname === "/registrieren")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Protect non-public routes
  const isPublic = PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Seiten-Auth (api ausgenommen — Auth läuft pro Route)
    // Static-Files (Bilder, ads.txt, robots.txt, sitemap.xml) muessen ohne Auth-
    // Redirect direkt ausgeliefert werden — sonst schlaegt AdSense-Verifikation fehl.
    "/((?!_next/static|_next/image|favicon.ico|images|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
