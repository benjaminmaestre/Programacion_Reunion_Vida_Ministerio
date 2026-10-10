"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle, BookOpen, Eye, EyeOff, Gem, LockKeyhole, Mail,
  Languages, Network, ShieldCheck, Users,
} from "lucide-react";

type LoginScreenProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string;
  description?: string;
};

export function LoginScreen({
  onSubmit,
  loading,
  error,
  description = "Utiliza tu cuenta autorizada para acceder a la plataforma.",
}: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="auth-screen" aria-label="Inicio de sesión">
      <div className="auth-visual">
        <div className="auth-visual-brand">
          <span className="auth-brand-mark">RVM</span>
          <span>Reunión Vida y Ministerio Cristianos</span>
        </div>

        <div className="auth-visual-copy">
          <p className="auth-eyebrow">Planificación de la congregación</p>
          <h1>Programación de la Reunión Vida y Ministerio Cristianos</h1>
          <p className="auth-visual-description">
            Organiza las asignaciones semanales, consulta la participación y prepara los formularios S-140 desde un mismo lugar.
          </p>
        </div>

        <div className="auth-illustration" aria-hidden="true">
          <svg className="auth-wave-lines" viewBox="0 0 760 300" preserveAspectRatio="none">
            <path d="M-20 176 C105 80 145 260 270 164 S445 80 565 164 S680 223 790 122" />
            <path d="M-20 194 C105 98 145 278 270 182 S445 98 565 182 S680 241 790 140" />
            <path d="M-20 212 C105 116 145 296 270 200 S445 116 565 200 S680 259 790 158" />
            <path d="M-20 230 C105 134 145 314 270 218 S445 134 565 218 S680 277 790 176" />
            <path d="M-20 248 C105 152 145 332 270 236 S445 152 565 236 S680 295 790 194" />
          </svg>
          <div className="auth-illustration-icons">
            <div className="auth-icon-tile auth-icon-users"><Users size={36} strokeWidth={1.5} /></div>
            <div className="auth-icon-tile auth-icon-translate"><Languages size={36} strokeWidth={1.5} /></div>
            <div className="auth-icon-tile auth-icon-gem"><Gem size={38} strokeWidth={1.5} /></div>
            <div className="auth-icon-tile auth-icon-network"><Network size={38} strokeWidth={1.5} /></div>
            <div className="auth-book-emblem"><BookOpen size={100} strokeWidth={1.35} /></div>
          </div>
          <div className="auth-visual-caption"><ShieldCheck size={15} /> Acceso seguro para usuarios autorizados</div>
        </div>

        <div className="auth-visual-footer">
          Herramientas para preparar las reuniones con orden y claridad.
        </div>
      </div>

      <div className="auth-login-side">
        <div className="auth-login-card">
          <img className="auth-login-mark" src="/images/jw-org-logo.webp" alt="JW.org" width={72} height={72} />
          <h2>Iniciar sesión</h2>
          <p className="auth-login-description">{description}</p>

          <form className="auth-login-form" onSubmit={onSubmit}>
            <div className="auth-field-group">
              <label htmlFor="login-email">Correo electrónico</label>
              <div className="auth-input-wrap">
                <Mail size={17} aria-hidden="true" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="Correo electrónico"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="login-password">Contraseña</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-login-error" id="auth-login-error" role="alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button className="auth-login-submit" disabled={loading} type="submit">
              <LockKeyhole size={16} />
              {loading ? "Iniciando sesión…" : "Iniciar sesión"}
            </button>
          </form>

          <div className="auth-login-footer">
            <ShieldCheck size={15} />
            <span>El acceso se habilita únicamente mediante una cuenta autorizada por el administrador.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
