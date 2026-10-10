"use client";
import { useState } from "react";
import { CalendarDays, Users, ShieldCheck } from "lucide-react";
import { MembersWorkspace } from "@/features/members/MembersWorkspace";
import { ProgramsWorkspace } from "@/features/programs/ProgramsWorkspace";

type Tab = "programs" | "members";

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("programs");
  const items: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "programs", label: "Programas", icon: CalendarDays },
    { id: "members", label: "Directorio", icon: Users },
  ];
  return (
    <div className="shell">
      <nav className="rail" aria-label="Navegación principal">
        <div className="rail-mark" aria-hidden="true">RVM</div>
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className="rail-link" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
            <Icon size={20} />{label}
          </button>
        ))}
        <a href="/admin/users" className="rail-link" aria-label="Administrar cuentas">
          <ShieldCheck size={20} />Usuarios
        </a>
      </nav>
      <main>{tab === "members" ? <MembersWorkspace /> : <ProgramsWorkspace />}</main>
    </div>
  );
}
