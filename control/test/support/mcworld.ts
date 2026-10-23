import { spawnSync } from "node:child_process";

/** Legt eine echte .mcworld-Datei (ZIP) an, Dateien liegen im Wurzelverzeichnis wie bei Minecraft. */
export function makeMcworld(path: string, files: Record<string, string>) {
  const script =
    "import json, sys, zipfile\n" +
    "with zipfile.ZipFile(sys.argv[1], 'w') as z:\n" +
    "    for name, content in json.loads(sys.argv[2]).items(): z.writestr(name, content)\n";
  const result = spawnSync("python3", ["-c", script, path, JSON.stringify(files)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
}
