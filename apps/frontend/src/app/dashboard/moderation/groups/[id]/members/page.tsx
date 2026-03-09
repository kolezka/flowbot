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
import { ExportButton } from "@/components/export-button";

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "creator":
    case "admin":
      return (
        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
          {role}
        </Badge>
      );
    case "moderator":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          {role}
        </Badge>
      );
    case "restricted":
      return <Badge variant="destructive">{role}</Badge>;
    default:
      return <Badge variant="secondary">{role}</Badge>;
  }
}

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
  const [quarantineFilter, setQuarantineFilter] = useState<boolean | undefined>(undefined);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const pageSize = 20;

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  useEffect(() => {
    loadMembers();
  }, [groupId, page, search, quarantineFilter]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

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
        isQuarantined: quarantineFilter,
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

  const handleRoleChange = async (member: GroupMember, newRole: string) => {
    const action = newRole === "moderator" ? "promote" : "demote";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${member.firstName || member.username || member.telegramId} to ${newRole}?`
    );
    if (!confirmed) return;

    setRoleUpdating(member.id);
    setFeedback(null);
    try {
      await api.updateMemberRole(groupId, member.id, newRole);
      setFeedback({
        type: "success",
        message: `Successfully ${action}d ${member.firstName || member.username || member.telegramId} to ${newRole}`,
      });
      await loadMembers();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : `Failed to ${action} member`;
      setFeedback({ type: "error", message });
    } finally {
      setRoleUpdating(null);
    }
  };

  const handleRelease = async (member: GroupMember) => {
    const confirmed = window.confirm(
      `Release ${member.firstName || member.username || member.telegramId} from quarantine?`
    );
    if (!confirmed) return;

    setReleasing(member.id);
    setFeedback(null);
    try {
      await api.releaseMember(groupId, member.id);
      setFeedback({
        type: "success",
        message: `Successfully released ${member.firstName || member.username || member.telegramId} from quarantine`,
      });
      await loadMembers();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Failed to release member";
      setFeedback({ type: "error", message });
    } finally {
      setReleasing(null);
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
        <div className="flex items-center gap-2">
          <ExportButton
            endpoint={`/api/moderation/groups/${groupId}/members/export`}
            filename={`members-${groupId}`}
            filters={{ role: undefined }}
          />
          <Link href={`/dashboard/moderation/groups/${groupId}`}>
            <Button variant="outline">Back to Group</Button>
          </Link>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg p-4 ${
            feedback.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              {[
                { label: "All", value: undefined },
                { label: "Quarantined", value: true },
                { label: "Not Quarantined", value: false },
              ].map((opt) => (
                <Button
                  key={opt.label}
                  variant={quarantineFilter === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setQuarantineFilter(opt.value);
                    setPage(1);
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
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
                  <TableHead>Quarantine</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
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
                        <RoleBadge role={member.role} />
                      </TableCell>
                      <TableCell>{member.messageCount.toLocaleString()}</TableCell>
                      <TableCell>
                        {member.warningCount > 0 ? (
                          <Badge variant="destructive">{member.warningCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.isQuarantined ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="destructive">Quarantined</Badge>
                            {member.quarantineExpiresAt && (
                              <span className="text-xs text-muted-foreground">
                                Expires: {new Date(member.quarantineExpiresAt).toLocaleDateString()}
                              </span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={releasing === member.id}
                              onClick={() => handleRelease(member)}
                            >
                              {releasing === member.id ? "Releasing..." : "Release"}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.lastSeenAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {member.role === "admin" || member.role === "creator" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Protected
                          </span>
                        ) : member.role === "member" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={roleUpdating === member.id}
                            onClick={() => handleRoleChange(member, "moderator")}
                          >
                            {roleUpdating === member.id ? "Updating..." : "Promote"}
                          </Button>
                        ) : member.role === "moderator" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={roleUpdating === member.id}
                            onClick={() => handleRoleChange(member, "member")}
                          >
                            {roleUpdating === member.id ? "Updating..." : "Demote"}
                          </Button>
                        ) : null}
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
