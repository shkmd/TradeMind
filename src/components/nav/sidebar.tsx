"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart } from "lucide-react";
import type { RoleKey } from "@prisma/client";
import { cn } from "@/lib/utils";
import { visibleNavSections } from "@/components/nav/nav-config";

export function SidebarNav({ roles }: { roles: RoleKey[] }) {
  const pathname = usePathname();
  const sections = visibleNavSections(roles);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <LineChart className="h-6 w-6 shrink-0" />
        <span className="text-base font-semibold tracking-tight">TradeMind India</span>
      </div>
      <nav className="nav-scroll flex-1 space-y-5 overflow-y-auto px-2 pb-4">
        {sections.map((section, idx) => (
          <div key={section.label ?? `section-${idx}`}>
            {section.label && (
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-nav-foreground/50">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-nav-accent text-white font-medium"
                          : "text-nav-foreground/80 hover:bg-nav-accent/60 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-nav-border px-4 py-3 text-[11px] text-nav-foreground/50">
        For informational and analytical use only. Not investment advice.
      </div>
    </div>
  );
}
