/** Schickt `gamerule` ohne Argumente und liest die Regeln aus der Server-Ausgabe. */
export default defineEventHandler((): Promise<Rules> => readRules());
