"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, X,
} from "lucide-react";
import { createNeonBrowserClient } from "@/lib/neon/client";

type NeonBrowserClient = ReturnType<typeof createNeonBrowserClient>;

type PasswordChangeDialogProps = {
  client: NeonBrowserClient;
  onClose: () => void;
};

export function PasswordChangeDialog({ client, onClose }: PasswordChangeDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || done) return;
    setError("");

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("La nueva contraseña debe ser diferente de la actual.");
      return;
    }

    setSaving(true);
    try {
      const { data: currentData, error: currentUserError } = await client.auth.getUser();
      const currentUser = currentData.user;
      if (currentUserError || !currentUser?.email || !currentUser.id) {
        throw new Error("No se pudo verificar la cuenta de la sesión. Vuelve a iniciar sesión.");
      }

      // Reauthenticate before changing the credential, so the current password is verified.
      const { data: verifiedData, error: verifyError } = await client.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });
      if (verifyError || !verifiedData.user || verifiedData.user.id !== currentUser.id) {
        throw new Error("La contraseña actual no es correcta.");
      }

      const { error: updateError } = await client.auth.updateUser({ password: newPassword });
      if (updateError) {
        throw new Error(updateError.message || "No se pudo actualizar la contraseña.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop password-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="modal-card password-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-dialog-title"
      >
        <div className="modal-header">
          <div className="password-dialog-heading">
            <span className="password-dialog-icon"><KeyRound size={19} /></span>
            <div>
              <h2 className="modal-title" id="password-dialog-title">Cambiar contraseña</h2>
              <p className="modal-description">Actualiza la clave de acceso de tu cuenta.</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar ventana"
          >
            <X size={17} />
          </button>
        </div>

        {done ? (
          <div className="password-dialog-success">
            <CheckCircle2 size={34} />
            <h3>Contraseña actualizada</h3>
            <p>Tu nueva contraseña quedó guardada. Utilízala la próxima vez que inicies sesión.</p>
            <button type="button" className="button button-primary" onClick={onClose}>Listo</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="password-dialog-body">
              <p className="password-dialog-note">
                Por seguridad, confirma tu contraseña actual y escribe la nueva dos veces.
                Debe tener al menos 8 caracteres.
              </p>

              <div className="form-field">
                <label className="field-label" htmlFor="password-current">Contraseña actual</label>
                <div className="password-dialog-input">
                  <LockKeyhole size={16} aria-hidden="true" />
                  <input
                    id="password-current"
                    className="field"
                    type={showPasswords ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="field-label" htmlFor="password-new">Nueva contraseña</label>
                <div className="password-dialog-input">
                  <KeyRound size={16} aria-hidden="true" />
                  <input
                    id="password-new"
                    className="field"
                    type={showPasswords ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="field-label" htmlFor="password-confirm">Confirmar nueva contraseña</label>
                <div className="password-dialog-input">
                  <KeyRound size={16} aria-hidden="true" />
                  <input
                    id="password-confirm"
                    className="field"
                    type={showPasswords ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <label className="password-dialog-show">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(event) => setShowPasswords(event.target.checked)}
                  disabled={saving}
                />
                Mostrar contraseñas
              </label>

              {error && (
                <div className="inline-alert" role="alert">
                  <AlertTriangle size={15} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="button" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="button button-primary" disabled={saving}>
                <KeyRound size={15} />
                {saving ? "Actualizando…" : "Guardar contraseña"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
