import { auth, signOut } from "@/auth";
import { AdminSidebar } from "@/components/mcc/admin-sidebar";
import { WavalidatorCredits } from "@/components/mcc/wavalidator-credits";
import { Button } from "@/components/ui/button";
import { LogOut, Wifi, Shield } from "lucide-react";

export default async function MccLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="/mcc" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-mcc-blue text-white">
              <Wifi className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight text-foreground">MCC Painel</span>
              <span className="text-[10px] leading-tight text-muted-foreground">Minha Casa Conectada</span>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <WavalidatorCredits />
            <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 sm:flex">
              <Shield className="size-3.5 text-mcc-blue" />
              <span className="text-xs font-medium text-slate-600">
                {session.user.name ?? session.user.email}
              </span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/mcc/login" });
              }}
            >
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-red-600" type="submit">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <AdminSidebar />
          <section>{children}</section>
        </div>
      </main>

      <footer className="border-t bg-white/50 py-4">
        <p className="text-center text-xs text-muted-foreground">
          Minha Casa Conectada &mdash; Painel Administrativo
        </p>
      </footer>
    </div>
  );
}
