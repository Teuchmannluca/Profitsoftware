"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  PoundSterling,
  Megaphone,
  Warehouse,
  RotateCcw,
  Star,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "P&L", href: "/pnl", icon: PoundSterling, soon: true },
  { label: "PPC / Ads", href: "/ppc", icon: Megaphone, soon: true },
  { label: "Inventory", href: "/inventory", icon: Warehouse },
  { label: "Reimbursements", href: "/reimbursements", icon: RotateCcw, soon: true },
  { label: "Reviews", href: "/reviews", icon: Star, soon: true },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const initials = email
    .split("@")[0]
    .split(/[._-]/)
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col bg-sidebar-bg border-r border-white/[0.06]">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
          <span className="text-[11px] font-bold text-white">PT</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-white">Profit Tracker</p>
          <p className="text-[10px] text-white/40">Amazon UK</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
              } ${item.soon ? "cursor-default" : ""}`}
            >
              <item.icon
                className={`h-4 w-4 ${
                  isActive ? "text-indigo-400" : "text-white/40 group-hover:text-white/60"
                }`}
              />
              {item.label}
              {item.soon && (
                <span className="ml-auto text-[9px] uppercase tracking-wider text-white/25 font-semibold">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-3 space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/50 hover:bg-white/[0.06] hover:text-white/80 transition-all duration-150"
        >
          <Settings className="h-4 w-4 text-white/40" />
          Settings
        </Link>

        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/20 to-purple-400/20 ring-1 ring-white/10">
            <span className="text-[10px] font-semibold text-indigo-300">
              {initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white/60 truncate">{email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-md p-1 text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
