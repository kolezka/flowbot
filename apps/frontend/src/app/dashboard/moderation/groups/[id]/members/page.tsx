"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, GroupMember, ManagedGroup } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function GroupMembersPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<ManagedGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 20;

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  useEffect(() => {
    loadMembers();
  }, [groupId, page, search]);

  const loadGroup = async () => {
    try {
      const data = await api.getGroup(groupId);
      setGroup(data);
    } catch {
      // Group info is supplementary, ignore errors
    }
  };

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getGroupMembers(groupId, {
        page,
        limit: pageSize,
        search: search || undefined,
      });
      setMembers(data.data);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load members";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "creator":
        return "default" as const;
      case "admin":
        return "default" as const;
      case "member":
        return "secondary" as const;
      case "restricted":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            Members {group ? `- ${group.title || `Chat ${group.chatId}`}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground">
            {total} total members
          </p>
        </div>
        <Link href={`/dashboard/moderation/groups/${groupId}`}>
          <Button variant="outline">Back to Group</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Member List</CardTitle>
            <Input
              className="max-w-xs"
              placeholder="Search members..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
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
                  <TableHead>Telegram ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Warnings</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No members found
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {member.firstName || ""} {member.lastName || ""}
                          </span>
                          {member.username && (
                            <span className="text-sm text-muted-foreground ml-1">
                              @{member.username}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/dashboard/users/${member.telegramId}/profile`}
                          className="text-blue-600 hover:underline"
                        >
                          {member.telegramId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{member.messageCount.toLocaleString()}</TableCell>
                      <TableCell>
                        {member.warningCount > 0 ? (
                          <Badge variant="destructive">{member.warningCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.lastSeenAt).toLocaleDateString()}
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
