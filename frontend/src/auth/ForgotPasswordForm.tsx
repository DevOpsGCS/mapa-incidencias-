import { FormEvent, useState } from "react";
import { requestPasswordReset } from "../api/authClient";
import { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS, AUTH_LINK_CLASS, AUTH_PRIMARY_BUTTON_CLASS } from "./AuthBackground";

interface ForgotPasswordFormProps {
  onBack: () => void;
}

// Siempre el mismo texto, exista o no el correo — no hay forma de que la UI
// distinga ambos casos, y así debe seguir siendo.
const GENERIC_CONFIRMATION =
  "Si el correo existe en nuestro sistema, vas a recibir instrucciones para restablecer tu contraseña.";

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // A propósito: nunca se muestra un error distinto acá — el mensaje de
      // éxito es el mismo pase lo que pase, para no filtrar qué correos
      // existen ni delatar fallas puntuales del envío.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-text">{GENERIC_CONFIRMATION}</p>
        <button
          type="button"
          onClick={onBack}
          className={AUTH_LINK_CLASS}
        >
          Volver a iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className={AUTH_LABEL_CLASS}>
        Correo electrónico
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
          className={AUTH_INPUT_CLASS}
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className={AUTH_PRIMARY_BUTTON_CLASS}
      >
        {submitting ? "Enviando..." : "Enviar instrucciones"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className={AUTH_LINK_CLASS}
      >
        Volver a iniciar sesión
      </button>
    </form>
  );
}
