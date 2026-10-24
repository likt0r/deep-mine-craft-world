/** Anzeige von Größen und Zeiten im Bereich System. */

const GB = 1024 ** 3;

/** 6730656 kB → „6,4 GB“ */
export function formatGb(bytes: number): string {
  return `${(bytes / GB).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: bytes < 10 * GB ? 1 : 0 })} GB`;
}

/** 8040 → „2 Std. 14 Min.“, 270000 → „3 Tage 3 Std.“ */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} ${days === 1 ? "Tag" : "Tage"} ${hours} Std.`;
  if (hours > 0) return `${hours} Std. ${minutes} Min.`;
  return `${minutes} Min.`;
}

/** ISO-Zeitpunkt → „heute, 09:35“, „gestern, 18:30“ oder „22.10.2026, 18:30“ */
export function formatWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86_400_000);
  if (diff === 0) return `heute, ${time}`;
  if (diff === 1) return `gestern, ${time}`;
  return `${date.toLocaleDateString("de-DE")}, ${time}`;
}

/** 12_345_678 → „11,8 MB“, kleine Dateien in KB. */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

/** ISO-Zeitpunkt (auch ohne Zeitzone) → „24.10.2026“ */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}
