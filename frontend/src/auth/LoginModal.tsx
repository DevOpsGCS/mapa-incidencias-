import { useState } from "react";
import { AUTH_LINK_CLASS, AuthBackground } from "./AuthBackground";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LoginForm } from "./LoginForm";

type Mode = "login" | "forgot-password";

export function LoginModal() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <AuthBackground heading={mode === "login" ? "Iniciar sesión" : "Recuperar contraseña"}>
      {mode === "login" ? (
        <div className="space-y-4">
          <LoginForm />
          <button
            type="button"
            onClick={() => setMode("forgot-password")}
            className={AUTH_LINK_CLASS}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      ) : (
        <ForgotPasswordForm onBack={() => setMode("login")} />
      )}
    </AuthBackground>
  );
}
