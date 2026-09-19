import { requireSession } from "@/lib/auth/rbac";
import { SidebarNav } from "@/components/nav/sidebar";
import { TopBar } from "@/components/nav/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      <aside className="hidden w-64 shrink-0 bg-nav text-nav-foreground lg:flex">
        <SidebarNav roles={session.user.roles} />
      </aside>
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <TopBar name={session.user.name ?? null} email={session.user.email ?? ""} roles={session.user.roles} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
