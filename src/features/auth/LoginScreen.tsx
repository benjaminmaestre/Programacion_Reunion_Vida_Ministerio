"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck,
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
        <div className="auth-visual-heading">
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
        </div>

        <div className="auth-illustration">
          <img
            className="auth-artwork"
            src="/images/login-illustrations.webp"
            alt="Ilustraciones de la congregación, el estudio bíblico, la enseñanza y la traducción."
            width={600}
            height={300}
          />
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
