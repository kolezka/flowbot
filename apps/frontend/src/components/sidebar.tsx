"use client";

import { useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";
import { ConnectionStatus } from "@/components/connection-status";
import {
  Activity,
  ChevronDown,
  Menu,
  Shield,
  Users,
  BarChart3,
  FileText,
  Radio,
  Eye,
  Layers,
  X,
  Workflow,
  Zap,
  Calendar,
  Copy,
  Heart,
  Trophy,
  Gauge,
  LogOut,
  Bot,
  Settings,
  Globe,
  FileText as FileTextIcon,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavChild {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string;
  icon: LucideIcon;
  href?: string; // standalone link (no children)
  children?: NavChild[];
}

// ---------------------------------------------------------------------------
// Navigation data
// ---------------------------------------------------------------------------

const navigation: NavSection[] = [
  {
    label: "Overview",
    icon: BarChart3,
    href: "/dashboard",
  },
  {
    label: "Bot Config",
    icon: Bot,
    children: [
      { label: "Instances", href: "/dashboard/bot-config", icon: Settings },
    ],
  },
  {
    label: "Connections",
    icon: Globe,
    children: [
      { label: "Overview", href: "/dashboard/connections", icon: Globe },
      { label: "Health", href: "/dashboard/connections/health", icon: Activity },
    ],
  },
  {
    label: "Flows",
    icon: Workflow,
    children: [
      { label: "All Flows", href: "/dashboard/flows", icon: Workflow },
      { label: "Analytics", href: "/dashboard/flows/analytics", icon: BarChart3 },
      { label: "Templates", href: "/dashboard/flows/templates", icon: FileTextIcon },
      { label: "Webhooks", href: "/dashboard/webhooks", icon: Globe },
    ],
  },
  {
    label: "Communities",
    icon: Building2,
    children: [
      { label: "Overview", href: "/dashboard/communities", icon: Building2 },
    ],
  },
  {
    label: "Identity",
    icon: Users,
    children: [
      { label: "Accounts", href: "/dashboard/identity/accounts", icon: Users },
      { label: "Linked Identities", href: "/dashboard/identity/linked", icon: Layers },
    ],
  },
  {
    label: "Moderation",
    icon: Shield,
    children: [
      { label: "Overview", href: "/dashboard/moderation", icon: Eye },
      { label: "Groups", href: "/dashboard/moderation/groups", icon: Layers },
      { label: "Logs", href: "/dashboard/moderation/logs", icon: FileText },
      {
        label: "Analytics",
        href: "/dashboard/moderation/analytics",
        icon: BarChart3,
      },
      {
        label: "Scheduled",
        href: "/dashboard/moderation/scheduled-messages",
        icon: Calendar,
      },
    ],
  },
  {
    label: "Community",
    icon: Heart,
    children: [
      {
        label: "Reputation",
        href: "/dashboard/community/reputation",
        icon: Trophy,
      },
    ],
  },
  {
    label: "Automation",
    icon: Zap,
    children: [
      { label: "Broadcast", href: "/dashboard/broadcast", icon: Radio },
      { label: "Health", href: "/dashboard/automation/health", icon: Activity },
      { label: "Jobs", href: "/dashboard/automation/jobs", icon: Activity },
      { label: "Cross-post", href: "/dashboard/automation/crosspost-templates", icon: Copy },
    ],
  },
  {
    label: "System",
    icon: Gauge,
    children: [
      { label: "Status", href: "/dashboard/system/status", icon: Activity },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

function isSectionActive(pathname: string, section: NavSection): boolean {
  if (section.href) {
    return isLinkActive(pathname, section.href);
  }
  return (
    section.children?.some((child) => isLinkActive(pathname, child.href)) ??
    false
  );
}

// ---------------------------------------------------------------------------
// Mobile sidebar context — allows trigger and sidebar to share state without
// prop drilling through the layout.
// ---------------------------------------------------------------------------

interface MobileSidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextValue>({
  open: false,
  setOpen: () => {},
});

export function MobileSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// NavLink
// ---------------------------------------------------------------------------

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader (collapsible)
// ---------------------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  label,
  expanded,
  onToggle,
  hasChildren,
}: {
  icon: LucideIcon;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  hasChildren: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={hasChildren ? expanded : undefined}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
      {hasChildren && (
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SidebarContent — shared between desktop and mobile
// ---------------------------------------------------------------------------

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  // Manual user toggles — tracks explicit collapse/expand actions
  const [manualToggles, setManualToggles] = useState<Record<string, boolean>>(
    {}
  );

  // Compute effective expanded state: auto-expand active sections,
  // but respect manual toggles for inactive ones
  const expanded = useMemo(() => {
    const state: Record<string, boolean> = {};
    for (const section of navigation) {
      if (section.children && section.children.length > 0) {
        const active = isSectionActive(pathname, section);
        // Active sections are always expanded; inactive ones use manual toggle
        state[section.label] =
          active || (manualToggles[section.label] ?? false);
      }
    }
    return state;
  }, [pathname, manualToggles]);

  const toggle = (label: string) => {
    setManualToggles((prev) => ({
      ...prev,
      [label]: !expanded[label],
    }));
  };

  return (
    <nav role="navigation" aria-label="Dashboard navigation" className="flex flex-col gap-1 px-3 py-4">
      {navigation.map((section) => {
        // Standalone link (no children)
        if (section.href) {
          return (
            <NavLink
              key={section.label}
              href={section.href}
              icon={section.icon}
              label={section.label}
              active={isLinkActive(pathname, section.href)}
              onClick={onNavigate}
            />
          );
        }

        const hasChildren = (section.children?.length ?? 0) > 0;
        const isExpanded = expanded[section.label] ?? false;

        return (
          <div key={section.label} className="flex flex-col">
            <SectionHeader
              icon={section.icon}
              label={section.label}
              expanded={isExpanded}
              onToggle={() => toggle(section.label)}
              hasChildren={hasChildren}
            />
            {hasChildren && isExpanded && (
              <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-3 pt-1">
                {section.children!.map((child) => (
                  <NavLink
                    key={child.label}
                    href={child.href}
                    icon={child.icon}
                    label={child.label}
                    active={isLinkActive(pathname, child.href)}
                    onClick={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Sidebar (desktop + mobile overlay)
// ---------------------------------------------------------------------------

function LogoutButton() {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <div className="border-t border-border p-3">
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-accent-foreground"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Logout</span>
      </button>
    </div>
  );
}

export function Sidebar() {
  const { open, setOpen } = useContext(MobileSidebarContext);
  const pathname = usePathname();
  const mobileSidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Close mobile sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Focus trap for mobile sidebar
  useEffect(() => {
    if (!open || !mobileSidebarRef.current) return;

    // Store the element that triggered the sidebar
    triggerRef.current = document.activeElement as HTMLElement;

    const sidebar = mobileSidebarRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    // Focus first focusable element
    const firstFocusable = sidebar.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = sidebar.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0]!;
      const last = focusableElements[focusableElements.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Return focus to trigger when sidebar closes
  useEffect(() => {
    if (!open && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Link href="/dashboard" className="text-lg font-bold">
            Flowbot Dashboard
          </Link>
          <ConnectionStatus />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarContent />
        </div>
        <LogoutButton />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Sidebar panel */}
          <aside
            ref={mobileSidebarRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 left-0 flex w-64 flex-col bg-card shadow-lg"
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-6">
              <Link
                href="/dashboard"
                className="text-lg font-bold"
                onClick={() => setOpen(false)}
              >
                Flowbot Dashboard
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </div>
            <LogoutButton />
          </aside>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// MobileSidebarTrigger — hamburger button for the top bar
// ---------------------------------------------------------------------------

export function MobileSidebarTrigger() {
  const { setOpen } = useContext(MobileSidebarContext);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={() => setOpen(true)}
      aria-label="Open sidebar"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
