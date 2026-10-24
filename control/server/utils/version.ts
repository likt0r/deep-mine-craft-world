import { readFile } from "node:fs/promises";

/** Version von Deep Mine Control aus der Versionsdatei des Pakets (`{ version, commit }`), sonst „dev“. */
export async function readVersion(): Promise<string> {
  try {
    const { version } = JSON.parse(await readFile(useRuntimeConfig().versionFile, "utf8"));
    return typeof version === "string" && version ? version : "dev";
  } catch {
    return "dev";
  }
}
