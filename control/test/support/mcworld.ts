import { spawnSync } from "node:child_process";

/** Legt eine echte .mcworld-Datei (ZIP) an, Dateien liegen im Wurzelverzeichnis wie bei Minecraft. */
export function makeMcworld(path: string, files: Record<string, string>) {
  // Inhalte über stdin: ein einzelnes Argument darf unter Linux höchstens 128 KB lang sein.
  const script =
    "import json, sys, zipfile\n" +
    "with zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED) as z:\n" +
    "    for name, content in json.load(sys.stdin).items(): z.writestr(name, content)\n";
  const result = spawnSync("python3", ["-c", script, path], {
    input: JSON.stringify(files),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr);
}
