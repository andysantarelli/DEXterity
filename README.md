# DEXterity

DEXterity is a compact, Champions-first VGC reference app built for fast mid-match lookups. Search by Pokemon name or Pokedex number to see stats, typings, abilities, common moves and items, EV guidance, and quick damage calculations without digging through multiple sites.

## Features

- Champions-first source selection, with Scarlet and Violet fallback when Champions data is unavailable
- Common moves and item usage from Pikalytics
- EV and build fallback from Game8 when usage spread data is missing
- Base stats, typing, and ability blurbs from PokeAPI
- Automatic quick-reference damage calcs into top meta matchups
- Manual level 50 doubles damage calculator with a compact advanced options drawer

## Data Sources

- `Pikalytics`: usage data, common moves, common items, and matchup-oriented references
- `Game8`: build pages and EV fallback data
- `PokeAPI`: Pokemon species data, typings, stats, and ability descriptions
- `@smogon/calc`: battle math engine for damage calculations

## Run Locally

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Share It With Friends

The easiest setup is:

1. Push this project to GitHub.
2. Deploy it as a Node web service on Render or Railway.
3. Share the generated URL.

### Push To GitHub

```bash
git init
git add .
git commit -m "Initial DEXterity app"
```

Then create an empty GitHub repo and connect it:

```bash
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

## Deploy On Render

1. Sign in to [Render](https://render.com/).
2. Create a new `Web Service`.
3. Connect your GitHub repo.
4. Use these settings:
   - Build command: `npm install`
   - Start command: `npm start`
5. Deploy and share the URL Render gives you.

## Deploy On Railway

1. Sign in to [Railway](https://railway.com/).
2. Create a new project from your GitHub repo.
3. Confirm:
   - Build command: `npm install`
   - Start command: `npm start`
4. Deploy and share the generated URL.

## Project Structure

- [`server.js`](/Users/asantarelli/Documents/New%20project/server.js): HTTP server and API routes
- [`lib/providers.js`](/Users/asantarelli/Documents/New%20project/lib/providers.js): provider-based data and calc architecture
- [`public/index.html`](/Users/asantarelli/Documents/New%20project/public/index.html): app shell
- [`public/app.js`](/Users/asantarelli/Documents/New%20project/public/app.js): client logic and rendering
- [`public/styles.css`](/Users/asantarelli/Documents/New%20project/public/styles.css): compact dark-mode UI styling

## Notes

- The app depends on live third-party data, so occasional upstream site changes can affect parsing until adapters are updated.
- Free hosting tiers may sleep when idle, so the first request can be slower.
- Manual calculations use the selected sets and options, while the automatic matchup cards stay optimized for quick reference.
