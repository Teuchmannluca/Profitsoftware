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
  PanelLeftClose,
  PanelLeftOpen,
  PackagePlus,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect, createContext, useContext } from "react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Cost of Goods", href: "/costs", icon: Receipt },
  { label: "Analysis", href: "/product", icon: Package },
  { label: "Capital", href: "/capital", icon: Coins },
  { label: "P&L", href: "/pnl", icon: PoundSterling, soon: true },
  { label: "PPC / Ads", href: "/ppc", icon: Megaphone },
  { label: "Order Map", href: "/map", icon: MapPin },
  { label: "Inventory", href: "/inventory", icon: Warehouse },
  { label: "Restock", href: "/restock", icon: PackagePlus },
  { label: "Reimbursements", href: "/reimbursements", icon: RotateCcw },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Reviews", href: "/reviews", icon: Star, soon: true },
];

const SIDEBAR_KEY = "sidebar-collapsed";

const SidebarContext = createContext(false);
export function useSidebarCollapsed() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  return (
    <SidebarContext.Provider value={collapsed}>
      {children}
    </SidebarContext.Provider>
  );
}

export function MobileMenuButton() {
  function openMenu() {
    window.dispatchEvent(new CustomEvent("mobile-menu", { detail: true }));
  }

  return (
    <button
      onClick={openMenu}
      className="md:hidden flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") setCollapsed(true);

    function onMobileMenu(e: Event) {
      setMobileOpen((e as CustomEvent).detail);
    }
    window.addEventListener("mobile-menu", onMobileMenu);
    return () => window.removeEventListener("mobile-menu", onMobileMenu);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_KEY, String(next));
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: next }));
  }

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

  const w = collapsed ? "w-[68px]" : "w-[240px]";

  const sidebarContent = (
    <>
      {/* Logo + Toggle */}
      <div className="flex h-16 items-center justify-between px-3">
        <div className={`flex items-center gap-3 ${collapsed && !mobileOpen ? "justify-center w-full" : "pl-2"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-indigo shadow-lg shadow-indigo-500/20">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-foreground truncate">LAK & Co. Group</p>
              <p className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase">Amazon Dashboard</p>
            </div>
          )}
        </div>
        {mobileOpen ? (
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        ) : !collapsed ? (
          <button
            onClick={toggle}
            className="rounded-lg p-1.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors hidden md:block"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {collapsed && !mobileOpen && (
        <div className="flex justify-center px-3 pb-2">
          <button
            onClick={toggle}
            className="rounded-lg p-1.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {(!collapsed || mobileOpen) && (
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Main
          </p>
        )}
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const showLabel = !collapsed || mobileOpen;
          return (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              title={!showLabel ? item.label : undefined}
              onClick={() => mobileOpen && setMobileOpen(false)}
              className={`group relative flex items-center ${!showLabel ? "justify-center" : ""} gap-3 rounded-xl ${!showLabel ? "px-0 py-2.5" : "px-3 py-2.5"} text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              } ${item.soon ? "cursor-default opacity-60" : ""}`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-indigo" />
              )}
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive
                    ? "text-indigo-500"
                    : "text-muted-foreground/50 group-hover:text-muted-foreground"
                }`}
              />
              {showLabel && (
                <>
                  {item.label}
                  {item.soon && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 bg-muted px-1.5 py-0.5 rounded-md">
                      Soon
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-3 space-y-0.5">
        <Link
          href="/settings"
          title={!collapsed || mobileOpen ? undefined : "Settings"}
          onClick={() => mobileOpen && setMobileOpen(false)}
          className={`flex items-center ${!collapsed || mobileOpen ? "" : "justify-center"} gap-3 rounded-xl ${!collapsed || mobileOpen ? "px-3" : "px-0"} py-2.5 text-[13px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-150`}
        >
          <Settings className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          {(!collapsed || mobileOpen) && "Settings"}
        </Link>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={collapsed && !mobileOpen ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
          className={`flex items-center ${!collapsed || mobileOpen ? "" : "justify-center"} gap-3 rounded-xl ${!collapsed || mobileOpen ? "px-3" : "px-0"} py-2.5 text-[13px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-150 w-full`}
        >
          <Sun className="h-4 w-4 shrink-0 text-muted-foreground/50 dark:hidden" />
          <Moon className="h-4 w-4 shrink-0 text-muted-foreground/50 hidden dark:block" />
          {(!collapsed || mobileOpen) && (
            <>
              <span className="dark:hidden">Dark Mode</span>
              <span className="hidden dark:block">Light Mode</span>
            </>
          )}
        </button>

        <div className={`flex items-center ${!collapsed || mobileOpen ? "gap-3" : "justify-center"} rounded-xl ${!collapsed || mobileOpen ? "px-3" : "px-0"} py-2.5 mt-1 bg-muted/50`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-indigo shadow-md shadow-indigo-500/15">
            <span className="text-[11px] font-bold text-white">{initials}</span>
          </div>
          {(!collapsed || mobileOpen) && (
            <>
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
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex fixed inset-y-0 left-0 z-50 ${w} flex-col bg-sidebar-bg border-r border-sidebar-border transition-all duration-200`}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-sidebar-bg border-r border-sidebar-border animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
