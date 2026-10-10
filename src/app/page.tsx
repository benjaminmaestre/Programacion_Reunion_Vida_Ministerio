"use client";

import { useCallback, useState } from "react";
import { BookOpenCheck, CalendarDays, LogOut, Users, ShieldCheck } from "lucide-react";
import { MembersWorkspace } from "@/features/members/MembersWorkspace";
import { ProgramsWorkspace } from "@/features/programs/ProgramsWorkspace";

type Tab = "programs" | "members";
type SignOutAction = () => Promise<void>;

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("programs");
  const [signOutAction, setSignOutAction] = useState<SignOutAction | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const registerSignOutAction = useCallback((action: SignOutAction | null) => {
    setSignOutAction(() => action);
  }, []);

  async function handleSidebarSignOut() {
    if (!signOutAction || isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOutAction();
    } finally {
      setIsSigningOut(false);
    }
  }
  const items: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "programs", label: "Programas", icon: CalendarDays },
    { id: "members", label: "Directorio", icon: Users },
  ];

  return (
    <div className="shell">
      <nav className="rail" aria-label="Navegación principal">
        <div className="rail-brand" aria-label="Reunión Vida y Ministerio Cristianos">
          <span className="rail-mark" aria-hidden="true"><BookOpenCheck size={25} strokeWidth={1.8} /></span>
          <span className="rail-brand-title">REUNIÓN</span>
          <span className="rail-brand-subtitle">VIDA Y MINISTERIO</span>
        </div>

        <div className="rail-nav">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="rail-link"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <span className="rail-link-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.9} /></span>
              <span className="rail-link-label">{label}</span>
            </button>
          ))}
        </div>

        <div className="rail-footer">
          <a href="/admin/users" className="rail-link" aria-label="Administrar cuentas">
            <span className="rail-link-icon" aria-hidden="true"><ShieldCheck size={19} strokeWidth={1.9} /></span>
            <span className="rail-link-label">Usuarios</span>
          </a>
          <button
            type="button"
            className="rail-link rail-link-logout"
            onClick={() => void handleSidebarSignOut()}
            disabled={!signOutAction || isSigningOut}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <span className="rail-link-icon" aria-hidden="true"><LogOut size={19} strokeWidth={1.9} /></span>
            <span className="rail-link-label">{isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}</span>
          </button>
        </div>
      </nav>
      <main>{tab === "members"
        ? <MembersWorkspace onRegisterSignOut={registerSignOutAction} />
        : <ProgramsWorkspace onRegisterSignOut={registerSignOutAction} />}
      </main>
    </div>
  );
}
