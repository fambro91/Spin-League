# Spin League

Campionato di calcio asincrono tra amici: ogni club nasce da una serie di ruote animate, poi si gioca una giornata al giorno alle 21:00 (ora di Roma), con highlights animati, classifica, mercato del giro di boa e cronaca serale su Telegram.

Tutto gira sul piano **gratuito** di Cloudflare: un solo Worker serve l'app React, le API, il database D1, il cron orario e la cronaca con Workers AI.

## Messa online (una volta sola)

### 1. Database D1
1. Dashboard Cloudflare → **Storage & databases → D1 → Create database**, nome `spin-league`.
2. Copia il **Database ID**.
3. In questo repository apri `wrangler.jsonc` e sostituisci `00000000-0000-0000-0000-000000000000` con l'ID (su GitHub: matita ✏️ → *Commit changes*).

Le tabelle si creano da sole al primo avvio.

### 2. Collegare il repository
1. Dashboard → **Workers & Pages → Create → Import a repository** → scegli `Spin-League`.
2. Lascia i comandi proposti, o imposta:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
3. Conferma. Dopo un paio di minuti l'app è online su `https://spin-league.<tuo-account>.workers.dev`.

Ogni push sul ramo principale ripubblica l'app da sola.

### 3. Bot Telegram (facoltativo ma consigliato)
1. Su Telegram scrivi a **@BotFather** → `/newbot` → copia il token.
2. Dashboard → il Worker `spin-league` → **Settings → Variables and Secrets → Add** → tipo **Secret**, nome `TELEGRAM_BOT_TOKEN`, valore = token.
3. Aggiungi il bot al gruppo degli amici.
4. Nell'app, pagina organizzatore → **Collega un gruppo** → scrivi nel gruppo `/collega CODICE`.

### 4. Opzioni
| Secret / variabile | A cosa serve |
| --- | --- |
| `CREATE_SECRET` | Se impostato, serve questo codice per creare un nuovo campionato (evita sconosciuti). |
| `AI_MODEL` | Modello Workers AI per la cronaca. Predefinito: `@cf/mistralai/mistral-small-3.1-24b-instruct`. |

Se la quota gratuita di Workers AI (10.000 neuroni al giorno) finisce, la cronaca usa un testo automatico: la giornata si gioca comunque.

## Come si gioca
1. Apri il sito e crea il campionato: diventi organizzatore e ricevi il tuo link da giocatore.
2. Aggiungi gli amici e manda a ognuno il suo link personale (niente registrazione).
3. Ognuno gira le ruote e fonda il club. Tre spin fortunati di fila sbloccano la ruota dorata.
4. Quando tutti sono pronti, l'organizzatore avvia: le squadre mancanti diventano CPU.
5. Ogni giorno, entro le 21:00, ognuno sceglie modulo, atteggiamento, turnover e discorso.
6. Alle 18:00 il bot ricorda chi non ha ancora scelto; alle 21:00 si gioca e arriva la cronaca.
7. A fine andata il mercato resta aperto un giorno. A fine stagione: premi, albo d'oro e nuova stagione.

L'organizzatore può anche giocare subito la prossima giornata (utile per provare).

## Sviluppo locale
```bash
npm install
npm run preview        # build + wrangler dev su http://localhost:8787
node scripts/e2e.mjs   # test end-to-end di una stagione intera (con wrangler dev attivo)
npm run tune           # simula 10.000 stagioni per tarare il motore
```

## Struttura
| Cartella | Contenuto |
| --- | --- |
| `shared/` | Regole del gioco: ruote, club, motore partita, campionato. Usate sia dal Worker sia dall'app. |
| `worker/` | API, database, cron, Telegram, cronaca AI. |
| `src/` | App React: ruote animate, scheda club, scelte, classifica, highlights. |
| `scripts/` | Taratura e test. |

## Taratura del motore
Su 10.000 stagioni simulate con 8 squadre: la squadra con il voto più alto vince il 49% delle volte (podio 85%), media 2,8 gol a partita, 42% vittorie in casa, 23% pareggi.
Costanti in `shared/engine.ts`: gol attesi = 1,25 × e^((Off' − Dif')/33).
