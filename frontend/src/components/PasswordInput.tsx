import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { InputHTMLAttributes, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Input de contraseña con botón de mostrar/ocultar — reutilizado en login, "olvidé mi contraseña" y en el panel admin. */
export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mt-1">
      <input {...props} type={visible ? "text" : "password"} className={`${className} w-full pr-9`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-strong"
      >
        {visible ? <IconEyeOff size={16} stroke={2} /> : <IconEye size={16} stroke={2} />}
      </button>
    </div>
  );
}
