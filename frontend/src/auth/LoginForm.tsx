import { FormEvent, useState } from "react";
import { PasswordInput } from "../components/PasswordInput";
import { useAuth } from "./AuthContext";
import {
  AUTH_ERROR_CLASS,
  AUTH_ERROR_STYLE,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_PASSWORD_INPUT_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
} from "./AuthBackground";

interface LoginFormProps {
  autoFocus?: boolean;
}

/** Formulario de login puro — lo usa el modal (LoginModal) y cualquier otro punto de entrada que se necesite a futuro. */
export function LoginForm({ autoFocus = true }: LoginFormProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className={AUTH_LABEL_CLASS}>
        Usuario
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus={autoFocus}
          required
          className={AUTH_INPUT_CLASS}
        />
      </label>

      <label className={AUTH_LABEL_CLASS}>
        Contraseña
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
