"use client";

import { useState, useEffect } from "react";

const SIDEBAR_KEY = "sidebar-collapsed";

export function MainContent({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") setCollapsed(true);

    function onToggle(e: Event) {
      setCollapsed((e as CustomEvent).detail);
    }
    window.addEventListener("sidebar-toggle", onToggle);
    return () => window.removeEventListener("sidebar-toggle", onToggle);
  }, []);

  return (
    <main className={`transition-all duration-200 ${collapsed ? "pl-[68px]" : "pl-[240px]"}`}>
      {children}
    </main>
  );
}
