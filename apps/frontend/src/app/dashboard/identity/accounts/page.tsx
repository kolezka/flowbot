"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, PlatformAccount } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, Column } from "@/components/responsive-table";
import { PlatformBadge } from "@/components/platform-badge";
import { Search, Users, ShieldAlert, ShieldCheck, UserPlus } from "lucide-react";

const accountColumns: Column<PlatformAccount>[] = [
  {
    header: "Platform",
    accessor: (account) => <PlatformBadge platform={account.platform} />,
  },
  {
    header: "Username",
    accessor: (account) =>
      account.username ? (
        <span className="font-medium">@{account.username}</span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
  },
  {
    header: "Display Name",
    accessor: (account) => {
      const name = [account.firstName, account.lastName].filter(Boolean).join(" ");
      return name ? (
        <span>{name}</span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      );
    },
    hideOnMobile: true,
  },
  {
    header: "Messages",
    accessor: "messageCount",
    cellClassName: "text-muted-foreground",
    hideOnMobile: true,
  },
  {
    header: "Status",
    accessor: (account) => (
      <div className="flex gap-1 flex-wrap">
        {account.isBanned ? (
          <Badge variant="destructive">Banned</Badge>
        ) : (
          <Badge variant="default">Active</Badge>
        )}
        {account.isVerified && (
          <Badge variant="secondary">Verified</Badge>
        )}
      </div>
    ),
  },
  {
    header: "Created",
    accessor: (account) => new Date(account.createdAt).toLocaleDateString(),
    cellClassName: "text-muted-foreground",
    hideOnMobile: true,
  },
];

interface AccountStats {
  totalAccounts: number;
  activeAccounts: number;
  bannedAccounts: number;
  newAccountsToday: number;
  verifiedAccounts: number;
  totalMessages: number;
  totalCommands: number;
  platformBreakdown: Record<string, number>;
}

export default function AccountsPage() {
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [bannedFilter, setBannedFilter] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [page, search, bannedFilter]);

  const loadStats = async () => {
    try {
      const data = await api.getAccountStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load account stats:", err);
      toast.error("Failed to load account stats");
    }
  };

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAccounts({
        page,
        limit: pageSize,
        search: search || undefined,
        isBanned: bannedFilter !== null ? bannedFilter : undefined,
      });
      setAccounts(data.data);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load accounts";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleBannedFilter = (filter: boolean | null) => {
    setBannedFilter(filter);
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Platform Accounts</h1>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Accounts"
          value={stats?.totalAccounts ?? 0}
          icon={<Users className="h-4 w-4" />}
          description="All platform accounts"
        />
        <StatCard
          title="Active Accounts"
          value={stats?.activeAccounts ?? 0}
          icon={<ShieldCheck className="h-4 w-4" />}
          description="Non-banned accounts"
        />
        <StatCard
          title="Banned Accounts"
          value={stats?.bannedAccounts ?? 0}
          icon={<ShieldAlert className="h-4 w-4" />}
          description="Currently banned"
          variant="destructive"
        />
        <StatCard
          title="New Today"
          value={stats?.newAccountsToday ?? 0}
          icon={<UserPlus className="h-4 w-4" />}
          description="Accounts joined today"
          variant="secondary"
        />
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>Platform Accounts</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by username..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant={bannedFilter === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleBannedFilter(null)}
                  title="Show all accounts"
                >
                  All
                </Button>
                <Button
                  variant={bannedFilter === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleBannedFilter(false)}
                  title="Show active accounts"
                >
                  Active
                </Button>
                <Button
                  variant={bannedFilter === true ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => handleBannedFilter(true)}
                  title="Show banned accounts"
                >
                  Banned
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          <ResponsiveTable
            columns={accountColumns}
            data={accounts}
            keyExtractor={(account) => account.id}
            loading={loading}
            emptyMessage="No accounts found"
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} accounts
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum =
                      totalPages <= 5
                        ? i + 1
                        : page <= 3
                          ? i + 1
                          : page >= totalPages - 2
                            ? totalPages - 4 + i
                            : page - 2 + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-9"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
  variant?: "default" | "destructive" | "secondary";
}

function StatCard({ title, value, icon, description, variant = "default" }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div
          className={
            variant === "destructive"
              ? "text-destructive"
              : variant === "secondary"
                ? "text-muted-foreground"
                : "text-primary"
          }
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
