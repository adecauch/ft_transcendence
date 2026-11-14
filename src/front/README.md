# front/ — 3D table and interface

Everything the player sees: the Three.js scene, the animations and the UI.
The rules and the AI are in `src/shared/`; `game/TableController.js` connects the two.

```
main.js                 boot: renderer, scene, UI, game wiring, render loop
config/newGameOptions.js  menu options (opponents, levels, stacks, blinds, defaults)
config/preferences.js     the player's options (pause menu → Options): add one = add an entry
config/rangePresets.js    the range chart's example ranges + French lessons (add one = add an entry)
render/                 Engine (scene, camera, renderer, loop), Lighting, AssetLoader
camera/                 CameraController (OrbitControls + limits), CameraMoves (overview,
                        player's seat, dealer show)
input/                  TableInput (hover/click on the start card, Esc), CardPicker (raycast)
game/TableController.js PokerGame events → animations and texts; the player's decisions
                        through the ActionBar; hands chained automatically
scene/
  room/                 Room, Table, Chairs, Lamps, DustParticles
  dealer/               Dealer (cowboy: seated, deals, all-in show), revolver (load, hold,
                        muzzle flash), crates (what he sits on), Gunshot (Web Audio)
  cards/                Card (one 3D card), CardTextures, TableCards (deck, hands, board, muck)
  chips/                ChipModel (one 3D chip), chipStacks (amount → chips), TableChips
                        (stacks, bets, pot + amount labels), labelStyles (the labels' CSS)
  start/                StartCard / StartCards — the "Nouvelle partie" card in front of the dealer
  seatLayout.js         where each seat's cards, stack and bet go on the felt
ui/
  A screen with its own CSS is a folder: the component(s) + styles.js (injected once).
  WelcomeScreen, AiDebugPanel (npm run debug_ia)
  newGame/              NewGameMenu ("Nouvelle partie": opponents, levels, stacks, blinds), styles
  actionBar/            ActionBar (situation + Se coucher / Suivre / Relancer + end-of-hand
                        message), RaisePanel (amount: field, slider, quick amounts, validation), styles
  pause/                PauseMenu (☰ button + pause window), OptionsPanel (⚙️ Options: one row
                        of buttons per entry of config/preferences.js + in-game shortcuts, e.g. B), styles
  preferences           the options' current values, remembered in the browser (getPref,
                        setPref, onPrefChange). New option = one entry in config/preferences.js
  chipUnit              "Montants" option: money() writes amounts in chips or big blinds.
                        Display only (the game stays in chips); views redraw on
                        onUnitChange(); in BB the raise is typed in BB
  auth/                 AuthScreen (log in / sign up / "Jouer sans compte", after the welcome screen), styles
  UserBadge             top right: 🤠 pseudo + Mes stats + Déconnexion (or "Invité" + Se connecter)
  stats/                "Mon carnet", the record book (badge "📊 Mes stats"):
    StatsMenu           the window and the tab switching only; a tab = { id, label, open(view), close? }
    format, styles      shared helpers (esc, cards, tiles…) and CSS
    tabs/               one file per tab: totalsTab, dashboardTab, historyTab (+ handHtml:
                        one hand told street by street), achievementsTab, solverTab
                        ("Face au solveur", the player vs the MCCFR strategy), leaderboardTab
    dashboard/          "Tableau de bord" (module 4, see server/STATS.md §7 quater):
      Dashboard         the tab: filters, tiles, charts, exports, live stream; destroy() stops it all
      charts            one Chart.js config per chart (curve, per day, VPIP/PFR, bb/100 groups, actions)
      filters           period / AI level / number of AIs → query string (local days + time zone)
      pdfExport         the dashboard's PDF (charts as images, on a pdf/pdfPage)
      styles            layout of the tab
    pdf/                the PDF exports (jsPDF, loaded on click only):
      pdfPage           shared page: leather background, title, paragraphs, tiles, page breaks
      solverPdf         "Face au solveur" as a PDF (same words as tabs/solverTab, bars as rectangles)
  AchievementToast      "Succès débloqué !" plaque during a game
  ranges/               the range chart (badge "📖 Ranges", pause menu; event `ranges:open`):
    RangeScreen         the window: tabs, closing, delegates to the active tab
    RangeGrid           the 13×13 grid: draw a view, select, paint, zones
    ExploreMode         🔍 example ranges + lessons + hand details
    BuildMode           🖌️ paint a range; logged in: save / open / update / delete it (SavedRange)
    Brush               the brush: pure actions or a mix (raise % / call % sliders, shortcuts, pipette)
    HistoryMode         📜 the range really played, preflop mistakes, biggest losses, next to the theory
    historyHtml         📜 the mistakes and biggest losses lists
    theoryData, theoryHtml  the preflop theory model (shared/theory/), loaded once; heat map, comparison
    draftStore          the range being painted, kept in this browser (localStorage)
    html, styles        shared HTML pieces, CSS
net/
  request.js            one fetch() to the back-end, never throws, French errors
  authApi.js            /api/auth (see server/README.md)
  gamesApi.js           /api/games, /api/stats, /api/leaderboard (see server/STATS.md)
  statsLive.js          EventSource on /api/stats/live: the dashboard reloads when a hand is saved
  rangesApi.js          /api/ranges: saved ranges (see server/README.md)
ui/ (continued)
  overlay/              Overlay + Panel (the menu window), panels (which menu to show), fade
  theme/saloon.css      shared saloon look (wood panels, gold sign, leather, .wood-btn);
                        fonts Rye / Lilita One / Nunito via @fontsource (self-hosted)
```
