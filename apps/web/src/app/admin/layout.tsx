import Link from "next/link";
import { requireStaff } from "@/lib/admin";
import { LogoutButton } from "./_components/logout-button";
import { CommandPalette } from "./_components/command-palette";

export const metadata = { title: "Admin · MyArea365" };

type NavItem = { href: string; label: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "",
    items: [
      { href: "/admin", label: "📊 Dashboard" },
    ],
  },
  {
    title: "COMMUNITY",
    items: [
      { href: "/admin/runners",     label: "🏃 Runner" },
      { href: "/admin/crews",       label: "👥 Crews" },
      { href: "/admin/territories", label: "🗺️ Territorien" },
      { href: "/admin/moderation",  label: "⚖️ Moderation" },
      { href: "/admin/support",     label: "🎫 Support-Tickets" },
      { href: "/admin/user-media",  label: "📸 User-Media" },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { href: "/admin/shops",     label: "🏪 Shops" },
      { href: "/admin/deals",     label: "⚡ Deals" },
      { href: "/admin/qr-codes",  label: "📱 QR-Codes" },
      { href: "/admin/sales",      label: "💰 Vertrieb & Umsatz" },
      { href: "/admin/marketing",  label: "📧 Marketing" },
      { href: "/admin/broadcasts", label: "📢 Broadcasts" },
    ],
  },
  {
    title: "GAME-DESIGN",
    items: [
      { href: "/admin/gamification", label: "🏆 Gamification" },
      { href: "/admin/missions",     label: "🎯 Missionen" },
      { href: "/admin/seasons",      label: "🗓️ Saisons" },
      { href: "/admin/experiments",  label: "🧪 A/B-Tests" },
      { href: "/admin/artwork",      label: "🎨 Artwork" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/admin/flags",  label: "🚩 Feature-Flags" },
      { href: "/admin/audit",  label: "📋 Audit-Log" },
      { href: "/admin/system", label: "⚙️ System" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, email } = await requireStaff();

  return (
    <div className="min-h-screen flex bg-[#0F1115] text-[#F0F0F0]">
      <aside className="w-64 bg-[#151922] border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-lg font-black text-[#22D1C3]">MyArea365</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF2D78]/20 text-[#FF2D78] font-bold">ADMIN</span>
          </Link>
          <div className="text-[11px] text-[#8b8fa3] mt-1 truncate">
            {email} · <span className="text-[#22D1C3]">{role}</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-3">
          {NAV.map((group, i) => (
            <div key={i}>
              {group.title && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-black tracking-[0.12em] text-[#6c7590]">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-3 py-2 rounded-lg text-sm text-[#dde3f5] hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link href="/dashboard" className="block text-xs text-[#8b8fa3] hover:text-white px-3 py-1.5">
            ← Zurück zur App
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-end gap-3 px-6 pt-4 text-[11px] text-[#6c7590]">
          <span>Drücke</span>
          <kbd className="px-2 py-0.5 bg-white/5 border border-white/10 rounded font-mono">⌘K</kbd>
          <span>für Schnellsuche</span>
        </div>
        <div className="p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>

      <CommandPalette />
    </div>
  );
}
