import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/authClient";
import { PasswordInput } from "../components/PasswordInput";
import {
  AUTH_ERROR_CLASS,
  AUTH_ERROR_STYLE,
  AUTH_LABEL_CLASS,
  AUTH_PASSWORD_INPUT_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthBackground,
} from "./AuthBackground";

/** Ruta pública /reset-password?token=... — no requiere sesión, es a donde lleva el enlace del correo de "¿Olvidaste tu contraseña?". */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restablecer la contraseña.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackground heading="Restablecer contraseña">
      {!token ? (
        <p className="text-center text-sm" style={AUTH_ERROR_STYLE}>
          Este enlace no es válido. Pedí uno nuevo desde la pantalla de inicio de sesión.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className={AUTH_LABEL_CLASS}>
            Contraseña nueva
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              minLength={8}
              className={AUTH_PASSWORD_INPUT_CLASS}
            />
          </label>

          <label className={AUTH_LABEL_CLASS}>
            Repetir contraseña nueva
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className={AUTH_PASSWORD_INPUT_CLASS}
            />
          </label>

          {error && (
        <p className={AUTH_ERROR_CLASS} style={AUTH_ERROR_STYLE}>
          {error}
        </p>
      )}

          <button
            type="submit"
            disabled={submitting}
            className={AUTH_PRIMARY_BUTTON_CLASS}
          >
            {submitting ? "Guardando..." : "Restablecer contraseña"}
          </button>
        </form>
      )}
    </AuthBackground>
  );
}
