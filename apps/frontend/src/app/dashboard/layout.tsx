import { Sidebar, MobileSidebarTrigger, MobileSidebarProvider } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <MobileSidebarProvider>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            {/* Mobile header */}
            <header className="flex h-14 items-center gap-3 border-b bg-card px-4 md:hidden">
              <MobileSidebarTrigger />
              <span className="text-lg font-bold">Allegro Dashboard</span>
            </header>
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </MobileSidebarProvider>
    </AuthGuard>
  );
}
