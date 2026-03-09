"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, Warning, ManagedGroup } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function GroupWarningsPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<ManagedGroup | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showActive, setShowActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 20;

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  useEffect(() => {
    loadWarnings();
  }, [groupId, page, showActive]);

  const loadGroup = async () => {
    try {
      const data = await api.getGroup(groupId);
      setGroup(data);
    } catch {
      // Group info is supplementary
    }
  };

  const loadWarnings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getWarnings({
        page,
        limit: pageSize,
        groupId,
        isActive: showActive,
      });
      setWarnings(data.data);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load warnings";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (warningId: string) => {
    try {
      await api.deactivateWarning(warningId);
      loadWarnings();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to deactivate warning";
      alert(message);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            Warnings {group ? `- ${group.title || `Chat ${group.chatId}`}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground">
            {total} {showActive ? "active" : "all"} warnings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showActive ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowActive(true);
              setPage(1);
            }}
          >
            Active
          </Button>
          <Button
            variant={!showActive ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowActive(false);
              setPage(1);
            }}
          >
            All
          </Button>
          <Link href={`/dashboard/moderation/groups/${groupId}`}>
            <Button variant="outline" size="sm">Back to Group</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Warning List</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : warnings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No warnings found
                    </TableCell>
                  </TableRow>
                ) : (
                  warnings.map((warning) => (
                    <TableRow key={warning.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/dashboard/users/${warning.userId}/profile`}
                          className="text-blue-600 hover:underline"
                        >
                          {warning.userId}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {warning.issuerId}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm">
                          {warning.reason || "No reason provided"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            warning.isActive
                              ? "destructive"
                              : warning.deactivatedAt
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {warning.isActive
                            ? "Active"
                            : warning.deactivatedAt
                              ? "Deactivated"
                              : "Expired"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {warning.expiresAt
                          ? new Date(warning.expiresAt).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(warning.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {warning.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeactivate(warning.id)}
                          >
                            Deactivate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, total)} of {total} warnings
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
