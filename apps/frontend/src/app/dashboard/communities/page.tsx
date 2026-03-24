"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Community } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, Column } from "@/components/responsive-table";
import { PlatformBadge } from "@/components/platform-badge";
import { Search, Globe, Users, Activity } from "lucide-react";

const communityColumns: Column<Community>[] = [
  {
    header: "Platform",
    accessor: (community) => <PlatformBadge platform={community.platform} />,
  },
  {
    header: "Name",
    accessor: (community) =>
      community.name ? (
        <span className="font-medium">{community.name}</span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
  },
  {
    header: "Type",
    accessor: (community) =>
      community.type ? (
        <span className="capitalize text-sm">{community.type}</span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
    hideOnMobile: true,
  },
  {
    header: "Members",
    accessor: "memberCount",
    cellClassName: "text-muted-foreground",
    hideOnMobile: true,
  },
  {
    header: "Status",
    accessor: (community) =>
      community.isActive ? (
        <Badge variant="default">Active</Badge>
      ) : (
        <Badge variant="secondary">Inactive</Badge>
      ),
  },
  {
    header: "Created",
    accessor: (community) => new Date(community.createdAt).toLocaleDateString(),
    cellClassName: "text-muted-foreground",
    hideOnMobile: true,
  },
  {
    header: "",
    accessor: (community) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/communities/${community.id}`}>View</Link>
      </Button>
    ),
  },
];

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    loadCommunities();
  }, [page, search, activeFilter]);

  const loadCommunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCommunities({
        page,
        limit: pageSize,
        search: search || undefined,
        isActive: activeFilter !== null ? activeFilter : undefined,
      });
      setCommunities(data.data);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load communities";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleActiveFilter = (filter: boolean | null) => {
    setActiveFilter(filter);
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Communities</h1>
          <p className="text-muted-foreground">Manage communities across all platforms</p>
        </div>
        <Link href="/dashboard/communities/create">
          <Button>Add Community</Button>
        </Link>
      </div>

      {/* Communities Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              All Communities
              <Badge variant="secondary">{total}</Badge>
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant={activeFilter === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleActiveFilter(null)}
                >
                  All
                </Button>
                <Button
                  variant={activeFilter === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleActiveFilter(true)}
                >
                  Active
                </Button>
                <Button
                  variant={activeFilter === false ? "outline" : "outline"}
                  size="sm"
                  onClick={() => handleActiveFilter(false)}
                >
                  Inactive
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
            columns={communityColumns}
            data={communities}
            keyExtractor={(community) => community.id}
            loading={loading}
            emptyMessage="No communities found"
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} communities
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
