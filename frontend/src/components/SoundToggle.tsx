import { IconVolume, IconVolumeOff } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { isSoundMuted, primeAudio, setSoundMuted, subscribeSoundMuted } from "../lib/notificationSound";

/** Botón chico para mutear/activar la campanada de ticket:new. El click también sirve como el gesto que el navegador exige para desbloquear el audio. */
export function SoundToggle() {
  const [muted, setMuted] = useState(isSoundMuted);

  useEffect(() => subscribeSoundMuted(setMuted), []);

  const handleClick = () => {
    primeAudio();
    setSoundMuted(!muted);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={muted ? "Activar sonido de notificaciones" : "Silenciar sonido de notificaciones"}
      aria-pressed={!muted}
      title={muted ? "Sonido desactivado" : "Sonido activado"}
      className={`flex h-9 w-9 items-center justify-center rounded-[6px] bg-surface-2 transition-colors ${
        muted ? "text-text" : "text-accent-text"
      }`}
    >
      {muted ? <IconVolumeOff size={16} stroke={2} /> : <IconVolume size={16} stroke={2} />}
    </button>
  );
}
