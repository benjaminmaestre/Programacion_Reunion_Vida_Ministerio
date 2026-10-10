"use client";

import { useState } from "react";
import { MembersWorkspace } from "@/features/members/MembersWorkspace";
import { ProgramsWorkspace } from "@/features/programs/ProgramsWorkspace";
import { Users, Calendar, ShieldCheck } from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"members" | "programs">("programs");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">S140</div>
          <span className="font-bold text-base tracking-tight">Vida y Ministerio</span>
        </div>
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveTab("programs")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === "programs"
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Calendar className="w-4 h-4" /> Programación
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === "members"
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" /> Directorio
          </button>
          <a href="/admin/users" className="px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Administrar cuentas">
            <ShieldCheck className="w-4 h-4" /> Usuarios
          </a>
        </nav>
      </header>
      <main className="flex-1">
        {activeTab === "members" && <MembersWorkspace />}
        {activeTab === "programs" && <ProgramsWorkspace />}
      </main>
    </div>
  );
}
