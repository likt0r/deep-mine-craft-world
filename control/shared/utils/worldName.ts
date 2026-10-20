/** Höchste Länge des Anzeigenamens einer Welt. Der Weltordner hängt nicht daran. */
export const WORLD_NAME_MAX = 40;

/**
 * Der Anzeigename landet auch in Chat-Nachrichten (`say`). Steuerzeichen wie Zeilenumbrüche
 * würden dort einen zweiten Konsolenbefehl ergeben und sind deshalb verboten.
 */
export function isValidWorldName(name: string): boolean {
  // eslint-disable-next-line no-control-regex -- genau die sollen raus
  return name.length >= 1 && name.length <= WORLD_NAME_MAX && !/[\u0000-\u001f\u007f]/.test(name);
}
