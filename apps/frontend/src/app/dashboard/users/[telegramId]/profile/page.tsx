"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, UnifiedProfile } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield, AlertTriangle, Users, Star, MessageSquare } from "lucide-react";

export default function UnifiedProfilePage() {
  const params = useParams();
  const router = useRouter();
  const telegramId = params.telegramId as string;

  const [profile, setProfile] = useState<UnifiedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [telegramId]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUnifiedProfile(telegramId);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading unified profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error || "Profile not found"}
        </div>
      </div>
    );
  }

  const totalWarnings = profile.memberships.reduce(
    (sum, m) => sum + m.activeWarnings.length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            Unified Profile
          </h1>
          <p className="text-muted-foreground">Telegram ID: {profile.telegramId}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Reputation</p>
                <p className="text-2xl font-bold">{profile.reputationScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Groups</p>
                <p className="text-2xl font-bold">{profile.memberships.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Warnings</p>
                <p className="text-2xl font-bold">{totalWarnings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">First Seen</p>
                <p className="text-sm font-medium">{formatDate(profile.firstSeenAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Bot User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Bot User</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.user ? (
            <div className="space-y-3">
              <InfoRow label="Name" value={`${profile.user.firstName || ""} ${profile.user.lastName || ""}`.trim() || "Not set"} />
              <InfoRow label="Username" value={profile.user.username ? `@${profile.user.username}` : "Not set"} />
              <InfoRow label="Language" value={profile.user.languageCode || "Not set"} />
              <InfoRow
                label="Status"
                value={
                  <Badge variant={profile.user.isBanned ? "destructive" : "default"}>
                    {profile.user.isBanned ? "Banned" : "Active"}
                  </Badge>
                }
              />
              {profile.user.isBanned && profile.user.banReason && (
                <InfoRow label="Ban Reason" value={profile.user.banReason} />
              )}
              <InfoRow
                label="Messages"
                value={
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    {profile.user.messageCount.toLocaleString()}
                  </span>
                }
              />
              <InfoRow label="Commands" value={profile.user.commandCount.toLocaleString()} />
              <InfoRow
                label="Verified"
                value={profile.user.verifiedAt ? <Badge>Verified</Badge> : <Badge variant="secondary">Not Verified</Badge>}
              />
              <InfoRow label="Registered" value={formatDate(profile.user.createdAt)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No sales bot account linked to this Telegram ID.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Group Memberships */}
      <Card>
        <CardHeader>
          <CardTitle>Group Memberships</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.memberships.length > 0 ? (
            <div className="space-y-4">
              {profile.memberships.map((membership) => (
                <div
                  key={membership.groupId}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">
                        {membership.title || `Group ${membership.chatId}`}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Chat ID: {membership.chatId}
                      </p>
                    </div>
                    <Badge variant={membership.role === "admin" ? "default" : "secondary"}>
                      {membership.role}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Joined: </span>
                      {formatDate(membership.joinedAt)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Messages: </span>
                      {membership.messageCount.toLocaleString()}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last seen: </span>
                      {formatDate(membership.lastSeenAt)}
                    </div>
                  </div>
                  {membership.activeWarnings.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-orange-500" />
                        Active Warnings ({membership.activeWarnings.length})
                      </h5>
                      {membership.activeWarnings.map((warning) => (
                        <div
                          key={warning.id}
                          className="rounded bg-orange-50 dark:bg-orange-950/20 p-2 text-sm"
                        >
                          <div className="flex justify-between">
                            <span>{warning.reason || "No reason"}</span>
                            <span className="text-muted-foreground">
                              {formatDate(warning.createdAt)}
                            </span>
                          </div>
                          {warning.expiresAt && (
                            <p className="text-xs text-muted-foreground">
                              Expires: {formatDate(warning.expiresAt)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not a member of any managed groups.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Moderation Log */}
      <Card>
        <CardHeader>
          <CardTitle>Moderation Log</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.moderationLogs.length > 0 ? (
            <div className="space-y-2">
              {profile.moderationLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.automated ? "secondary" : "default"}>
                        {log.action}
                      </Badge>
                      {log.automated && (
                        <Badge variant="outline">Auto</Badge>
                      )}
                    </div>
                    {log.reason && (
                      <p className="text-sm text-muted-foreground">{log.reason}</p>
                    )}
                    {log.groupTitle && (
                      <p className="text-xs text-muted-foreground">
                        Group: {log.groupTitle}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No moderation log entries for this user.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}
