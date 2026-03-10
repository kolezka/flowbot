import { Sidebar, MobileSidebarTrigger, MobileSidebarProvider } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { WebSocketProvider } from "@/lib/websocket";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <WebSocketProvider>
        <MobileSidebarProvider>
          <div className="flex min-h-screen bg-background">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:underline"
            >
              Skip to content
            </a>
            <Sidebar />
            <div className="flex flex-1 flex-col">
              {/* Mobile header */}
              <header className="flex h-14 items-center gap-3 border-b bg-card px-4 md:hidden">
                <MobileSidebarTrigger />
                <span className="text-lg font-bold">Allegro Dashboard</span>
              </header>
              <main id="main-content" className="flex-1 overflow-y-auto p-6">
                {children}
              </main>
            </div>
          </div>
        </MobileSidebarProvider>
      </WebSocketProvider>
    </AuthGuard>
  );
}
