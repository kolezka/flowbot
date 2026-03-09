"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ModerationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard/moderation", label: "Overview" },
    { href: "/dashboard/moderation/groups", label: "Groups" },
    { href: "/dashboard/moderation/logs", label: "Logs" },
    { href: "/dashboard/moderation/analytics", label: "Analytics" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Moderation</h1>
        <p className="text-muted-foreground">
          Manage groups, view moderation logs, and monitor warnings.
        </p>
      </div>

      <nav className="flex gap-2 border-b pb-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard/moderation"
              ? pathname === "/dashboard/moderation"
              : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                size="sm"
              >
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
