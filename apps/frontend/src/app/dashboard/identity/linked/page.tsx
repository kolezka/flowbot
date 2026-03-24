"use client";

import { useEffect, useState } from "react";
import { api, UserIdentity, PlatformAccount } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlatformBadge } from "@/components/platform-badge";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Search, Link2, Link2Off, ChevronDown, ChevronUp, Users } from "lucide-react";

export default function LinkedIdentitiesPage() {
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    loadIdentities();
  }, [page, search]);

  const loadIdentities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getIdentities({
        page,
        limit: pageSize,
        search: search || undefined,
      });
      setIdentities(data.data);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load identities";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleUnlink = async (identityId: string, accountId: string) => {
    const key = `${identityId}:${accountId}`;
    setUnlinkingId(key);
    try {
      const updated = await api.unlinkAccount(identityId, accountId);
      setIdentities((prev) =>
        prev.map((identity) => (identity.id === identityId ? updated : identity))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to unlink account";
      setError(message);
    } finally {
      setUnlinkingId(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Linked Identities</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage cross-platform user identities and linked accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{total} identit{total === 1 ? "y" : "ies"}</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or email..."
          className="pl-8"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Identity Cards */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : identities.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No identities found"
        />
      ) : (
        <div className="space-y-3">
          {identities.map((identity) => {
            const isExpanded = expandedIds.has(identity.id);
            const accountCount = identity.platformAccounts.length;

            return (
              <Card key={identity.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {identity.displayName ?? (
                          <span className="text-muted-foreground italic">Unnamed Identity</span>
                        )}
                      </CardTitle>
                      {identity.email && (
                        <p className="text-sm text-muted-foreground truncate">{identity.email}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {accountCount === 0 ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            No linked accounts
                          </Badge>
                        ) : (
                          identity.platformAccounts.slice(0, isExpanded ? undefined : 3).map((account) => (
                            <PlatformBadge key={account.id} platform={account.platform} />
                          ))
                        )}
                        {!isExpanded && accountCount > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{accountCount - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(identity.id)}
                      disabled={accountCount === 0}
                      className="shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && accountCount > 0 && (
                  <CardContent className="pt-0">
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Linked Accounts ({accountCount})
                      </p>
                      {identity.platformAccounts.map((account) => (
                        <LinkedAccountRow
                          key={account.id}
                          account={account}
                          onUnlink={() => handleUnlink(identity.id, account.id)}
                          isUnlinking={unlinkingId === `${identity.id}:${account.id}`}
                        />
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} identities
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
    </div>
  );
}

interface LinkedAccountRowProps {
  account: PlatformAccount;
  onUnlink: () => void;
  isUnlinking: boolean;
}

function LinkedAccountRow({ account, onUnlink, isUnlinking }: LinkedAccountRowProps) {
  const displayName = [account.firstName, account.lastName].filter(Boolean).join(" ");

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex items-center gap-3 min-w-0">
        <PlatformBadge platform={account.platform} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {account.username && (
              <span className="text-sm font-medium">@{account.username}</span>
            )}
            {displayName && (
              <span className="text-sm text-muted-foreground truncate">{displayName}</span>
            )}
            {!account.username && !displayName && (
              <span className="text-sm text-muted-foreground">ID: {account.platformUserId}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {account.isBanned && (
              <Badge variant="destructive" className="text-xs h-4">Banned</Badge>
            )}
            {account.isVerified && (
              <Badge variant="secondary" className="text-xs h-4">Verified</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {account.messageCount} msgs
            </span>
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onUnlink}
        disabled={isUnlinking}
        className="text-muted-foreground hover:text-destructive shrink-0"
        title="Unlink account"
      >
        {isUnlinking ? (
          <Link2 className="h-4 w-4 animate-spin" />
        ) : (
          <Link2Off className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
