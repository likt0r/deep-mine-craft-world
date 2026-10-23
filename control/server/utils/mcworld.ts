import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Entpackt eine .mcworld (ZIP) nach `dest` und gibt den Ordner mit `level.dat` zurück: das Wurzelverzeichnis
 * oder genau ein Unterordner (so packen manche Programme). Lehnt Pfade nach außen und zu große Archive ab.
 * Läuft mit Pythons zipfile, das auf jedem Ubuntu da ist.
 */
const SCRIPT = `
import os, sys, zipfile
archive, dest, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])
try:
    z = zipfile.ZipFile(archive)
except zipfile.BadZipFile:
    sys.exit("keine ZIP-Datei")
with z:
    infos = z.infolist()
    if sum(i.file_size for i in infos) > limit:
        sys.exit("ausgepackt zu groß")
    for i in infos:
        parts = i.filename.replace("\\\\", "/").split("/")
        if i.filename.startswith("/") or ".." in parts:
            sys.exit("ungültiger Pfad im Archiv")
    z.extractall(dest)
if os.path.isfile(os.path.join(dest, "level.dat")):
    print(dest)
else:
    dirs = [d for d in os.listdir(dest) if os.path.isdir(os.path.join(dest, d)) and d != "__MACOSX"]
    if len(dirs) == 1 and os.path.isfile(os.path.join(dest, dirs[0], "level.dat")):
        print(os.path.join(dest, dirs[0]))
    else:
        sys.exit("level.dat fehlt")
`;

/** Wirft mit einer kurzen deutschen Meldung, wenn die Datei keine brauchbare Welt ist. */
export async function extractMcworld(archive: string, dest: string): Promise<string> {
  try {
    const { pythonPath, worldMaxBytes } = useRuntimeConfig();
    const { stdout } = await run(pythonPath, ["-c", SCRIPT, archive, dest, String(worldMaxBytes)], {
      timeout: 300_000
    });
    return stdout.trim();
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim().split("\n").at(-1);
    throw new McworldError(stderr || "Datei lässt sich nicht entpacken");
  }
}

/** Die Datei ist keine brauchbare Welt (für 400 statt 500). */
export class McworldError extends Error {}
