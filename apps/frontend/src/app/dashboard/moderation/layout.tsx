export default function ModerationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Moderation</h1>
        <p className="text-muted-foreground">
          Manage groups, view moderation logs, and monitor warnings.
        </p>
      </div>
      {children}
    </div>
  );
}
