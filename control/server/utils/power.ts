import { execFile } from "node:child_process";

/**
 * Startet den Rechner neu oder schaltet ihn aus. Erst nach einer Sekunde, damit die Antwort noch
 * beim Tablet ankommt. systemd stoppt dabei BSM, und BSM speichert und stoppt Minecraft sauber.
 */
export function schedulePower(kind: "reboot" | "poweroff"): void {
  const { rebootCommand, poweroffCommand } = useRuntimeConfig();
  const [file, ...args] = String(kind === "reboot" ? rebootCommand : poweroffCommand).split(" ");
  setTimeout(() => {
    execFile(file!, args, (error) => {
      if (error)
        console.error(`Rechner ${kind === "reboot" ? "neu starten" : "ausschalten"} fehlgeschlagen:`, error);
    });
  }, 1000);
}
