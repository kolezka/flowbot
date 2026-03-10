"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Terminal, MessageSquare, LayoutGrid, History, Bot, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", href: "", icon: Bot },
  { label: "Commands", href: "/commands", icon: Terminal },
  { label: "Responses", href: "/responses", icon: MessageSquare },
  { label: "Menus", href: "/menus", icon: LayoutGrid },
  { label: "i18n", href: "/i18n", icon: Globe },
  { label: "Versions", href: "/versions", icon: History },
];

export default function BotConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const botId = params.botId as string;
  const basePath = `/dashboard/bot-config/${botId}`;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/bot-config">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            All Bots
          </Button>
        </Link>
      </div>

      {/* Tab navigation */}
      <nav className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const tabHref = `${basePath}${tab.href}`;
          const isActive = tab.href === ""
            ? pathname === basePath || pathname === `${basePath}/`
            : pathname.startsWith(tabHref);

          return (
            <Link
              key={tab.href}
              href={tabHref}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Page content */}
      {children}
    </div>
  );
}
