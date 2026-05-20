"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  PoundSterling,
  Megaphone,
  Warehouse,
  RotateCcw,
  Star,
  Settings,
  LogOut,
  BarChart3,
  Package,
  Coins,
  Moon,
  Sun,
  MapPin,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Cost of Goods", href: "/costs", icon: Receipt },
  { label: "Analysis", href: "/product", icon: Package },
  { label: "Capital", href: "/capital", icon: Coins },
  { label: "P&L", href: "/pnl", icon: PoundSterling, soon: true },
  { label: "PPC / Ads", href: "/ppc", icon: Megaphone, soon: true },
  { label: "Order Map", href: "/map", icon: MapPin },
  { label: "Inventory", href: "/inventory", icon: Warehouse },
  { label: "Reimbursements", href: "/reimbursements", icon: RotateCcw },
  { label: "Reviews", href: "/reviews", icon: Star, soon: true },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

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
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col bg-sidebar-bg border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-indigo shadow-lg shadow-indigo-500/20">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-foreground">ProfitFlow</p>
          <p className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase">Amazon UK</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Main
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              } ${item.soon ? "cursor-default opacity-60" : ""}`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-indigo" />
              )}
              <item.icon
                className={`h-4 w-4 transition-colors ${
                  isActive
                    ? "text-indigo-500"
                    : "text-muted-foreground/50 group-hover:text-muted-foreground"
                }`}
              />
              {item.label}
              {item.soon && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 bg-muted px-1.5 py-0.5 rounded-md">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-3 space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-150"
        >
          <Settings className="h-4 w-4 text-muted-foreground/50" />
          Settings
        </Link>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-150 w-full"
        >
          <Sun className="h-4 w-4 text-muted-foreground/50 dark:hidden" />
          <Moon className="h-4 w-4 text-muted-foreground/50 hidden dark:block" />
          <span className="dark:hidden">Dark Mode</span>
          <span className="hidden dark:block">Light Mode</span>
        </button>

        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 mt-1 bg-muted/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-indigo shadow-md shadow-indigo-500/15">
            <span className="text-[11px] font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-foreground truncate">{email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-muted-foreground/50 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
