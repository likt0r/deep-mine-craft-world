# deep-mine-craft-world

## Agent skills

### Issue tracker

Issues und Specs liegen als GitHub Issues in likt0r/deep-mine-craft-world. See `docs/agents/issue-tracker.md`.

### Triage labels

Die fünf Standard-Labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: ein `CONTEXT.md` und `docs/adr/` im Repo-Root. See `docs/agents/domain.md`.

## Deep Mine Control entwickeln

Die App liegt in `control/` (Nuxt 4, Nuxt UI 4). Begriffe stehen in `CONTEXT.md`.

- `npm test`: baut die App und führt die API-Tests aus (Vitest, `test/api/`)
- `npm run test:e2e`: baut die App und führt die Seitentests aus (Playwright, `test/e2e/`, Handy und Tablet)
- `npm run lint`, `npm run typecheck`

Jeder PR und jeder Push auf `main` läuft durch die CI-Pipeline (Job `check`): Lint, Typecheck, API-Tests und Seitentests. Gemergt wird nur grün.

Die Tests laufen gegen ein nachgebautes BSM (`test/support/fake-bsm.ts`) und temporäre Server-Ordner (`test/support/fixture.ts`). Braucht ein neues Feature eine weitere BSM-Route, wird sie dort ergänzt, mit derselben Antwortform wie das echte BSM 4.0.1.

Regeln:
- Deep Mine Control hat keine Anmeldung. Deshalb gibt es keinen Endpunkt für freie Konsolenbefehle, nur feste Aktionen mit geprüften Eingaben (zod).
- Getestet wird nur Verhalten von außen: HTTP-Anfrage rein, dann Antwort, BSM-Aufrufe und Dateien prüfen.
- BSM-REST: `properties/set` erwartet `{ properties }` und startet nicht neu. Dafür gibt es `restart`.
