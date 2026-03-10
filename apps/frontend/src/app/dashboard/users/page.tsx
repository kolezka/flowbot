"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, User, StatsResponse, UsersResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, Column } from "@/components/responsive-table";
import { Search, Users as UsersIcon, UserCheck, Ban, UserPlus } from "lucide-react";

const userColumns: Column<User>[] = [
  {
    header: "User",
    accessor: (user) => (
      <div>
        <div className="font-medium">
          {user.firstName} {user.lastName}
        </div>
        {user.username && (
          <div className="text-sm text-muted-foreground">@{user.username}</div>
        )}
      </div>
    ),
  },
  {
    header: "Telegram ID",
    accessor: "telegramId",
    cellClassName: "text-muted-foreground",
  },
  {
    header: "Messages",
    accessor: "messageCount",
  },
  {
    header: "Last Seen",
    accessor: (user) =>
      user.lastSeenAt
        ? new Date(user.lastSeenAt).toLocaleDateString()
        : "Never",
    cellClassName: "text-muted-foreground",
    hideOnMobile: true,
  },
  {
    header: "Status",
    accessor: (user) =>
      user.isBanned ? (
        <Badge variant="destructive">Banned</Badge>
      ) : (
        <Badge variant="default">Active</Badge>
      ),
  },
  {
    header: "",
    accessor: (user) => (
      <Link href={`/dashboard/users/${user.id}`}>
        <Button variant="ghost" size="sm">
          View
        </Button>
      </Link>
    ),
    cellClassName: "text-right",
    hideOnMobile: true,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [bannedFilter, setBannedFilter] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    loadStats();
    loadUsers();
  }, [page, search, bannedFilter]);

  const loadStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers(page, pageSize, search || undefined);
      let filteredUsers = data.data;

      if (bannedFilter !== null) {
        filteredUsers = filteredUsers.filter(user => user.isBanned === bannedFilter);
      }

      setUsers(filteredUsers);
      setTotalUsers(data.total);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
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

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={<UsersIcon className="h-4 w-4" />}
          description="All registered users"
        />
        <StatCard
          title="Active Users"
          value={stats?.activeUsers ?? 0}
          icon={<UserCheck className="h-4 w-4" />}
          description="Users active in last 7 days"
        />
        <StatCard
          title="Banned Users"
          value={stats?.bannedUsers ?? 0}
          icon={<Ban className="h-4 w-4" />}
          description="Currently banned users"
          variant="destructive"
        />
        <StatCard
          title="New Today"
          value={stats?.newUsersToday ?? 0}
          icon={<UserPlus className="h-4 w-4" />}
          description="Users joined today"
          variant="secondary"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>Users</CardTitle>
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
                  title="Show all users"
                >
                  All
                </Button>
                <Button
                  variant={bannedFilter === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleBannedFilter(false)}
                  title="Show active users"
                >
                  Active
                </Button>
                <Button
                  variant={bannedFilter === true ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => handleBannedFilter(true)}
                  title="Show banned users"
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
            columns={userColumns}
            data={users}
            keyExtractor={(user) => user.id}
            onRowClick={(user) => router.push(`/dashboard/users/${user.id}`)}
            loading={loading}
            emptyMessage="No users found"
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalUsers)} of {totalUsers} users
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = totalPages <= 5
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
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
        <div className={variant === "destructive" ? "text-destructive" : variant === "secondary" ? "text-muted-foreground" : "text-primary"}>
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
