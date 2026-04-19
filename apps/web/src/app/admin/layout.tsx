import Link from "next/link";
import { requireStaff } from "@/lib/admin";
import { LogoutButton } from "./_components/logout-button";

export const metadata = { title: "Admin · MyArea365" };

const NAV = [
  { href: "/admin", label: "📊 Dashboard", section: "dashboard" },
  { href: "/admin/runners", label: "🏃 Runner", section: "runners" },
  { href: "/admin/crews", label: "👥 Crews", section: "crews" },
  { href: "/admin/shops", label: "🏪 Shops", section: "shops" },
  { href: "/admin/deals", label: "⚡ Deals", section: "deals" },
  { href: "/admin/marketing", label: "📧 Marketing", section: "marketing" },
  { href: "/admin/sales", label: "💰 Sales", section: "sales" },
  { href: "/admin/gamification", label: "🏆 Gamification", section: "gamification" },
  { href: "/admin/artwork", label: "🎨 Artwork", section: "artwork" },
  { href: "/admin/moderation", label: "⚖️ Moderation", section: "moderation" },
  { href: "/admin/audit", label: "📋 Audit-Log", section: "audit" },
  { href: "/admin/flags", label: "🚩 Feature-Flags", section: "flags" },
  { href: "/admin/system", label: "⚙️ System", section: "system" },
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
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-lg text-sm text-[#dde3f5] hover:bg-white/5 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
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
        <div className="p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
