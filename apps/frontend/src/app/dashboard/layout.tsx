import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <h1 className="text-xl font-bold">Allegro Dashboard</h1>
            </Link>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Users</Button>
            </Link>
            <Link href="/dashboard/products">
              <Button variant="ghost">Products</Button>
            </Link>
            <Link href="/dashboard/categories">
              <Button variant="ghost">Categories</Button>
            </Link>
            <Link href="/dashboard/carts">
              <Button variant="ghost">Carts</Button>
            </Link>
            <Link href="/dashboard/broadcast">
              <Button variant="ghost">Broadcast</Button>
            </Link>
            <Link href="/dashboard/moderation">
              <Button variant="ghost">Moderation</Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
