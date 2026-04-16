# DEXterity

DEXterity is a compact, Champions-first VGC reference app built for fast mid-match decision support. Search by Pokemon name or Pokedex number to pull up stats, typings, abilities, common moves and items, EV guidance, and quick damage calculations in one place.

It is designed to be readable under time pressure: compact cards, clear labels, and matchup-focused information that is useful during team preview or in the middle of a set.

## Features

- Champions-first source selection, with Scarlet and Violet fallback when Champions data is unavailable
- Common moves and common items pulled from Pikalytics
- EV and build fallback from Game8 when usage spread data is missing
- Base stats, typings, and ability blurbs from PokeAPI
- Automatic quick-reference damage calcs into common meta matchups
- Manual level 50 doubles damage calculator with compact advanced options

## Why DEXterity

- Built for quick reference instead of long-form analysis
- Keeps Champions data prioritized as the format grows
- Combines usage data, curated builds, and damage checks in a single lookup flow
- Stays compact enough to use during a match without digging through tabs

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

## Project Structure

- `server.js`: HTTP server and API routes
- `lib/providers.js`: provider-based data and calc architecture
- `public/index.html`: app shell
- `public/app.js`: client logic and rendering
- `public/styles.css`: compact dark-mode UI styling

## Notes

- The app depends on live third-party data, so occasional upstream site changes can affect parsing until adapters are updated.
- Manual calculations use the selected sets and options, while the automatic matchup cards stay optimized for quick reference.
