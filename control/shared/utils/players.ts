/**
 * Gamertag wie bei Xbox: Buchstaben, Ziffern, Leerzeichen, optional `#1234`. Er kommt in Anführungszeichen in
 * Konsolenbefehle, deshalb sind keine erlaubt.
 */
export const GAMERTAG = /^[A-Za-z0-9 ]{1,16}(#\d{1,4})?$/;

/** Höchste Länge einer Nachricht beim Kicken oder eines Grunds beim Sperren. */
export const PLAYER_MESSAGE_MAX = 80;

/**
 * Nachricht oder Grund steht am Ende eines Konsolenbefehls. Anführungszeichen würden ihn verbiegen,
 * Zeilenumbrüche und andere Steuerzeichen einen zweiten Befehl ergeben.
 */
export function isValidPlayerMessage(text: string): boolean {
  // eslint-disable-next-line no-control-regex -- genau die sollen raus
  return text.length <= PLAYER_MESSAGE_MAX && !/["'\u0000-\u001f\u007f]/.test(text);
}
