"use client";

import { useState } from "react";
import { BookOpenCheck, CalendarDays, Users, ShieldCheck } from "lucide-react";
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
        </div>
      </nav>
      <main>{tab === "members" ? <MembersWorkspace /> : <ProgramsWorkspace />}</main>
    </div>
  );
}
