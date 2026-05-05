import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "user" | "support" | "marketing" | "sales" | "admin" | "super_admin";

const STAFF_ROLES: Role[] = ["support", "marketing", "sales", "admin", "super_admin"];
const ADMIN_ROLES: Role[] = ["admin", "super_admin"];

export async function requireStaff(): Promise<{ userId: string; role: Role; email: string | null }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: profile } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  const role = (profile?.role as Role) || "user";
  if (!STAFF_ROLES.includes(role)) redirect("/karte");
  return { userId: user.id, role, email: user.email || null };
}

export async function requireAdmin(): Promise<{ userId: string; role: Role; email: string | null }> {
  const ctx = await requireStaff();
  if (!ADMIN_ROLES.includes(ctx.role)) redirect("/admin");
  return ctx;
}

export async function logAudit(params: {
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    const { data: profile } = await sb.from("users").select("role").eq("id", user?.id || "").maybeSingle();
    await sb.from("admin_audit_log").insert({
      actor_id: user?.id,
      actor_role: profile?.role,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      details: params.details ?? {},
    });
  } catch {
    // non-fatal
  }
}

export function hasRole(role: Role, ...allowed: Role[]): boolean {
  return allowed.includes(role);
}

export function canAccess(role: Role, section: string): boolean {
  if (ADMIN_ROLES.includes(role)) return true;
  const matrix: Record<Role, string[]> = {
    user: [],
    support: ["dashboard", "runners", "crews", "moderation", "audit"],
    marketing: ["dashboard", "runners", "marketing", "audit"],
    sales: ["dashboard", "shops", "sales", "audit"],
    admin: [],
    super_admin: [],
  };
  return matrix[role]?.includes(section) ?? false;
}
