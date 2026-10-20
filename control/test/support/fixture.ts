import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Ordner, die auf dem echten Server unter /var/lib/bsm liegen, als temporäre Kopie. */
export interface ServerFixture {
  root: string;
  serverDir: string;
  worldsDir: string;
  backupDir: string;
  dataDir: string;
  outputFile: string;
  /** Alles leeren und mit einer einzigen Welt neu anlegen. */
  reset(levelName?: string): void;
  addWorld(folder: string): void;
  /** Legt eine Welt direkt auf einen Platz (Plätze-Datei und Weltordner), ohne die App. */
  seedPlace(place: number, world: Partial<WorldInfo> & { folder: string }): void;
  remove(): void;
}

export const DEFAULT_LEVEL_NAME = "Bedrock level";

export function createServerFixture(root = mkdtempSync(join(tmpdir(), "dmc-"))): ServerFixture {
  const serverDir = join(root, "servers", "Bedrock");
  const fixture: ServerFixture = {
    root,
    serverDir,
    worldsDir: join(serverDir, "worlds"),
    backupDir: join(root, "backups", "Bedrock"),
    dataDir: join(root, "deep-mine-control"),
    outputFile: join(serverDir, "server_output.txt"),
    reset(levelName = DEFAULT_LEVEL_NAME) {
      for (const dir of [fixture.serverDir, fixture.backupDir, fixture.dataDir]) {
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
      }
      fixture.addWorld(levelName);
      writeFileSync(fixture.outputFile, "");
    },
    addWorld(folder) {
      mkdirSync(join(fixture.worldsDir, folder, "db"), { recursive: true });
      writeFileSync(join(fixture.worldsDir, folder, "levelname.txt"), folder);
    },
    seedPlace(place, world) {
      const file = join(fixture.dataDir, "places.json");
      const stored: { place: number; world: WorldInfo }[] = existsSync(file)
        ? JSON.parse(readFileSync(file, "utf8"))
        : [];
      const entry: WorldInfo = {
        name: world.folder,
        type: "normal",
        mode: "creative",
        difficulty: "normal",
        createdAt: "2026-10-20T20:00:00.000Z",
        ...world
      };
      const next = [...stored.filter((e) => e.place !== place), { place, world: entry }];
      writeFileSync(
        file,
        JSON.stringify(
          next.sort((a, b) => a.place - b.place),
          null,
          2
        )
      );
      fixture.addWorld(world.folder);
    },
    remove() {
      rmSync(root, { recursive: true, force: true });
    }
  };
  fixture.reset();
  return fixture;
}
