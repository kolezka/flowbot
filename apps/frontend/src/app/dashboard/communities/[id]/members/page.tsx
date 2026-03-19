"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { api, CommunityMember } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, Column } from "@/components/responsive-table";
import { PlatformBadge } from "@/components/platform-badge";
import { ArrowLeft, Search } from "lucide-react";

const memberColumns: Column<CommunityMember>[] = [
  {
    header: "Platform",
    accessor: (m) => <PlatformBadge platform={m.platform ?? "telegram"} />,
  },
  {
    header: "Username",
    accessor: (m) =>
      m.username ? (
        <span className="font-medium">@{m.username}</span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
  },
  {
    header: "Role",
    accessor: (m) => (
      <Badge variant="outline" className="capitalize">
        {m.role}
      </Badge>
    ),
  },
  {
    header: "Messages",
    accessor: "messageCount",
    cellClassName: "text-muted-foreground",
    hideOnMobile: true,
  },
  {
    header: "Warnings",
    accessor: (m) =>
      m.warningCount > 0 ? (
        <Badge variant="destructive">{m.warningCount}</Badge>
      ) : (
        <span className="text-muted-foreground text-sm">0</span>
      ),
  },
  {
    header: "Status",
    accessor: (m) => (
      <div className="flex gap-1 flex-wrap">
        {m.isMuted && <Badge variant="secondary">Muted</Badge>}
        {m.isQuarantined && <Badge variant="destructive">Quarantined</Badge>}
        {!m.isMuted && !m.isQuarantined && (
          <Badge variant="default">Active</Badge>
        )}
      </div>
    ),
  },
  {
    header: "Joined",
    accessor: (m) => new Date(m.joinedAt).toLocaleDateString(),
    cellClassName: "text-muted-foreground",
    hideOnMobile: true,
  },
];

const ROLES = ["all", "member", "admin", "owner"];

export default function CommunityMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    loadMembers();
  }, [id, page, search, roleFilter]);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCommunityMembers(id, {
        page,
        limit: pageSize,
        search: search || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
      });
      setMembers(data.data);
      setTotal(data.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/communities/${id}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Community
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              Members
              <Badge variant="secondary">{total}</Badge>
            </CardTitle>
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
                {ROLES.map((role) => (
                  <Button
                    key={role}
                    variant={roleFilter === role ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setRoleFilter(role);
                      setPage(1);
                    }}
                    className="capitalize"
                  >
                    {role}
                  </Button>
                ))}
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
            columns={memberColumns}
            data={members}
            keyExtractor={(m) => m.id}
            loading={loading}
            emptyMessage="No members found"
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to{" "}
                {Math.min(page * pageSize, total)} of {total} members
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
