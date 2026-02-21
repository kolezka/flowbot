"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, User } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Ban, CheckCircle, MessageSquare, Terminal, Clock } from "lucide-react";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [showBanDialog, setShowBanDialog] = useState(false);

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUser(userId);
      setUser(data);
    } catch (err: any) {
      setError(err.message || "Failed to load user");
    } finally {
      setLoading(false);
    }
  };

  const handleBanToggle = async () => {
    if (!user) return;

    if (user.isBanned) {
      try {
        await api.setBanStatus(userId, false);
        await loadUser();
      } catch (err: any) {
        setError(err.message || "Failed to unban user");
      }
    } else {
      setShowBanDialog(true);
    }
  };

  const handleBanConfirm = async () => {
    try {
      await api.setBanStatus(userId, true, banReason);
      setShowBanDialog(false);
      setBanReason("");
      await loadUser();
    } catch (err: any) {
      setError(err.message || "Failed to ban user");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading user...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error || "User not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {user.firstName} {user.lastName}
          </h1>
          {user.username && (
            <p className="text-muted-foreground">@{user.username}</p>
          )}
        </div>
        <Button
          variant={user.isBanned ? "default" : "destructive"}
          onClick={handleBanToggle}
        >
          {user.isBanned ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Unban User
            </>
          ) : (
            <>
              <Ban className="mr-2 h-4 w-4" />
              Ban User
            </>
          )}
        </Button>
      </div>

      {showBanDialog && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Confirm Ban</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for banning this user.
            </p>
            <Input
              placeholder="Ban reason..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleBanConfirm}
                disabled={!banReason.trim()}
              >
                Confirm Ban
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowBanDialog(false);
                  setBanReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Telegram ID" value={user.telegramId} />
            <InfoRow label="Username" value={user.username ? `@${user.username}` : "Not set"} />
            <InfoRow label="First Name" value={user.firstName || "Not set"} />
            <InfoRow label="Last Name" value={user.lastName || "Not set"} />
            <InfoRow label="Language" value={user.languageCode || "Not set"} />
            <InfoRow
              label="Status"
              value={
                <Badge variant={user.isBanned ? "destructive" : "default"}>
                  {user.isBanned ? "Banned" : "Active"}
                </Badge>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Messages"
              value={
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  {user.messageCount.toLocaleString()}
                </span>
              }
            />
            <InfoRow
              label="Commands"
              value={
                <span className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  {user.commandCount.toLocaleString()}
                </span>
              }
            />
            <InfoRow
              label="Last Seen"
              value={user.lastSeenAt ? formatDate(user.lastSeenAt) : "Never"}
            />
            <InfoRow
              label="Last Message"
              value={user.lastMessageAt ? formatDate(user.lastMessageAt) : "Never"}
            />
            <InfoRow
              label="Member Since"
              value={formatDate(user.createdAt)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow
            label="Verified"
            value={user.verifiedAt ? <Badge>Verified</Badge> : <Badge variant="secondary">Not Verified</Badge>}
          />
          {user.isBanned && (
            <>
              <InfoRow
                label="Banned At"
                value={user.bannedAt ? formatDate(user.bannedAt) : "Unknown"}
              />
              <InfoRow label="Ban Reason" value={user.banReason || "No reason provided"} />
            </>
          )}
          <InfoRow label="Referral Code" value={user.referralCode || "None"} />
          {user.referredByUserId && (
            <InfoRow label="Referred By" value={user.referredByUserId} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="User ID" value={user.id} />
          <InfoRow label="Last Chat ID" value={user.lastChatId || "Not available"} />
          <InfoRow
            label="Updated"
            value={
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {formatDate(user.updatedAt)}
              </span>
            }
          />
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
