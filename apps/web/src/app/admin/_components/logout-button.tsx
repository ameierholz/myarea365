"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const sb = createClient();
        await sb.auth.signOut();
        router.push("/login");
      }}
      className="w-full text-left text-xs text-[#FF2D78] hover:bg-white/5 px-3 py-1.5 rounded-lg"
    >
      🚪 Ausloggen
    </button>
  );
}
