/** Die acht Spielregeln, die Deep Mine Control kennt, mit den Namen des `gamerule`-Befehls. */
export const RULE_NAMES = [
  "dodaylightcycle",
  "doweathercycle",
  "keepinventory",
  "domobspawning",
  "dofiretick",
  "tntexplodes",
  "pvp",
  "showcoordinates"
] as const;

export type RuleName = (typeof RULE_NAMES)[number];

/** Zustand einer Regel: `null`, wenn er nicht gelesen werden konnte („unbekannt“). */
export type RuleValue = boolean | null;

export type Rules = Record<RuleName, RuleValue>;

/** Anzeige in Deep Mine Control: Beschriftung und ob der Schalter den Regelwert umdreht. */
export const RULES = [
  { name: "dodaylightcycle", label: "Zeit anhalten", inverted: true },
  { name: "doweathercycle", label: "Wetter anhalten", inverted: true },
  { name: "keepinventory", label: "Sachen beim Sterben behalten", inverted: false },
  { name: "domobspawning", label: "Monster", inverted: false },
  { name: "dofiretick", label: "Feuer breitet sich aus", inverted: false },
  { name: "tntexplodes", label: "TNT explodiert", inverted: false },
  { name: "pvp", label: "Spieler können sich verletzen", inverted: false },
  { name: "showcoordinates", label: "Koordinaten anzeigen", inverted: false }
] as const satisfies readonly { name: RuleName; label: string; inverted: boolean }[];
