const cheerio = require('cheerio');
const { calculate, Field, Generations, Move, Pokemon, ABILITIES, ITEMS, MOVES, toID } = require('@smogon/calc');

const gen = Generations.get(9);
const DEFAULT_LEVEL = 50;
const GAME8_INDEXES = {
  champions: 'https://game8.co/games/Pokemon-Champions/archives/592129',
  sv: 'https://game8.co/games/Pokemon-Scarlet-Violet/archives/397804',
};
const PIKALYTICS_SOURCES = {
  champions: {
    key: 'champions',
    label: 'Pokemon Champions',
    indexUrl: 'https://www.pikalytics.com/pokedex/championstournaments?l=en',
    topUrl: 'https://www.pikalytics.com/champions?l=en',
    linkPattern: '/pokedex/championstournaments/',
  },
  sv: {
    key: 'sv',
    label: 'VGC 2026 Regulation Set F',
    indexUrl: 'https://pikalytics.com/pokedex/gen9vgc2026regf?l=en',
    topUrl: 'https://pikalytics.com/pokedex/gen9vgc2026regf?l=en',
    linkPattern: '/pokedex/gen9vgc2026regf/',
  },
};
const MOVE_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];
const MIN_USAGE_MOVE_PERCENT = 1;
const ENGLISH_OVERRIDES = {
  items: {
    'hierba blanca': 'White Herb',
    'herbe blanche': 'White Herb',
    'mouchoir choix': 'Choice Scarf',
    schattenbrille: 'Black Glasses',
    'sable doux': 'Soft Sand',
    'baie prune': 'Lum Berry',
    'baie prine': 'Lum Berry',
    'baie nanone': 'Yache Berry',
    'baie fraigo': 'Haban Berry',
    'baie sitrus': 'Sitrus Berry',
    'baie charti': 'Charti Berry',
    'baie selro': 'Roseli Berry',
    'ceinture force': 'Focus Sash',
    restes: 'Leftovers',
    'croc dragon': 'Dragon Fang',
    'herbe mental': 'Mental Herb',
    'vive griffe': 'Quick Claw',
    'orbe vie': 'Life Orb',
    lentilscope: 'Scope Lens',
    'roche royale': "King's Rock",
    charbon: 'Charcoal',
    'dracaufite x': 'Charizardite X',
    'dracaufite y': 'Charizardite Y',
    carchacrokite: 'Garchompite',
  },
  abilities: {
    intimidaci: 'Intimidate',
    'peau dure': 'Rough Skin',
    'voile sable': 'Sand Veil',
    'force sable': 'Sand Force',
    'force soleil': 'Solar Power',
    brasier: 'Blaze',
    sécheresse: 'Drought',
    secheresse: 'Drought',
    'griffe dure': 'Tough Claws',
  },
  moves: {
    'séisme': 'Earthquake',
    seisme: 'Earthquake',
    'draco-griffe': 'Dragon Claw',
    'éboulement': 'Rock Slide',
    eboulement: 'Rock Slide',
    abri: 'Protect',
    'trépignement': 'Stomping Tantrum',
    trepignement: 'Stomping Tantrum',
    'danse lames': 'Swords Dance',
    'lame de roc': 'Stone Edge',
    'tête de fer': 'Iron Head',
    'tete de fer': 'Iron Head',
    'direct toxik': 'Poison Jab',
    'piétisol': 'Bulldoze',
    pietisol: 'Bulldoze',
    'rafale écailles': 'Scale Shot',
    'rafale ecailles': 'Scale Shot',
    tomberoche: 'Rock Tomb',
    'draco-charge': 'Dragon Rush',
    telluriforce: 'Earth Power',
    'mâchouille': 'Crunch',
    machouille: 'Crunch',
    'crocs éclair': 'Thunder Fang',
    'crocs eclair': 'Thunder Fang',
    clonage: 'Substitute',
    'crocs feu': 'Fire Fang',
    'aqua-brèche': 'Aqua Tail',
    'aqua-breche': 'Aqua Tail',
    'griffe ombre': 'Shadow Claw',
    'casse-brique': 'Brick Break',
    'cavalerie lourde': 'High Horsepower',
    'piège de roc': 'Stealth Rock',
    'piege de roc': 'Stealth Rock',
    "coup d'main": 'Helping Hand',
    plaquage: 'Body Slam',
    damoclès: 'Double-Edge',
    damocles: 'Double-Edge',
    'draco-queue': 'Dragon Tail',
    'déflagration': 'Fire Blast',
    deflagration: 'Fire Blast',
    'vif roc': 'Accelerock',
    canicule: 'Heat Wave',
    'lance-soleil': 'Solar Beam',
    "lame d'air": 'Air Slash',
    boutefeu: 'Flare Blitz',
    'draco-danse': 'Dragon Dance',
    'ball météo': 'Weather Ball',
    'ball meteo': 'Weather Ball',
    surchauffe: 'Overheat',
  },
};

const VALID_ITEMS = new Map(ITEMS[gen.num].map((name) => [toID(name), name]));
const VALID_MOVES = new Map(Object.keys(MOVES[gen.num]).map((name) => [toID(name), name]));
const VALID_ABILITIES = new Map(ABILITIES[gen.num].map((name) => [toID(name), name]));

function createBaseContext() {
  return {
    pokemon: new Map(),
    abilities: new Map(),
    game8Indexes: new Map(),
    game8Entries: new Map(),
    game8IndexFetchedAt: new Map(),
    game8Pages: new Map(),
    pikalyticsIndexes: new Map(),
    pikalyticsIndexFetchedAt: new Map(),
    pikalyticsTop: new Map(),
    pikalyticsTopFetchedAt: new Map(),
    pikalyticsPages: new Map(),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'dexterity/1.0',
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  return response.json();
}

async function getAbilityDescription(context, abilityUrl) {
  if (context.abilities.has(abilityUrl)) return context.abilities.get(abilityUrl);
  const data = await fetchJson(abilityUrl);
  const englishEntry = data.effect_entries.find((entry) => entry.language.name === 'en');
  const description = englishEntry?.short_effect || englishEntry?.effect || 'No ability description available.';
  context.abilities.set(abilityUrl, description.replace(/\s+/g, ' ').trim());
  return context.abilities.get(abilityUrl);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'dexterity/1.0',
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  return response.text();
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeLookupAliases(name) {
  const aliases = new Set();
  const cleaned = normalizeName(name);
  if (cleaned) aliases.add(cleaned);
  const specialMap = {
    'indeedee female': ['indeedee f', 'indeedee-f'],
    'indeedee male': ['indeedee m', 'indeedee-m'],
    'ursaluna bloodmoon': ['bloodmoon ursaluna', 'ursaluna-bloodmoon'],
    'ninetales alola': ['alolan ninetales'],
    'arcanine hisui': ['hisuian arcanine'],
    'samurott hisui': ['hisuian samurott'],
    'goodra hisui': ['hisuian goodra'],
    'zoroark hisui': ['hisuian zoroark'],
    'lilligant hisui': ['hisuian lilligant'],
    'typhlosion hisui': ['hisuian typhlosion'],
    'avalugg hisui': ['hisuian avalugg'],
    'electrode hisui': ['hisuian electrode'],
    'decidueye hisui': ['hisuian decidueye'],
    'braviary hisui': ['hisuian braviary'],
    'tauros paldea blaze breed': ['paldean tauros fire', 'blaze breed tauros'],
    'tauros paldea aqua breed': ['paldean tauros water', 'aqua breed tauros'],
    'tauros paldea combat breed': ['paldean tauros'],
    'wo chien': ['wo-chien'],
    'chien pao': ['chien-pao'],
    'ting lu': ['ting-lu'],
    'chi yu': ['chi-yu'],
    'iron hands': ['iron-hands'],
    'iron bundle': ['iron-bundle'],
    'iron crown': ['iron-crown'],
    'iron boulder': ['iron-boulder'],
    'walking wake': ['walking-wake'],
    'roaring moon': ['roaring-moon'],
    'gouging fire': ['gouging-fire'],
    'raging bolt': ['raging-bolt'],
    'urshifu rapid strike': ['urshifu-rapid-strike'],
    'urshifu single strike': ['urshifu-single-strike'],
    'ogerpon hearthflame': ['ogerpon-hearthflame', 'ogerpon-hearthflame mask'],
    'ogerpon wellspring': ['ogerpon-wellspring', 'ogerpon-wellspring mask'],
    'ogerpon cornerstone': ['ogerpon-cornerstone', 'ogerpon-cornerstone mask'],
    'landorus therian': ['landorus-t', 'landorus-therian'],
  };
  (specialMap[cleaned] || []).forEach((alias) => aliases.add(alias));
  if (cleaned.endsWith(' f')) aliases.add(cleaned.replace(/ f$/, ' female'));
  if (cleaned.endsWith(' m')) aliases.add(cleaned.replace(/ m$/, ' male'));
  return [...aliases];
}

function capitalizeWord(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : '';
}

function displayNameFromApiName(name) {
  return String(name || '')
    .split('-')
    .map((part) => ({ hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }[part] || capitalizeWord(part)))
    .join(' ');
}

function formatStatName(statName) {
  return ({
    hp: 'HP',
    attack: 'Atk',
    defense: 'Def',
    'special-attack': 'SpA',
    'special-defense': 'SpD',
    speed: 'Spe',
  }[statName] || statName);
}

function toCalcStat(statLabel) {
  const cleaned = String(statLabel || '').toLowerCase().replace(/[^a-z]/g, '');
  return ({
    hp: 'hp', atk: 'atk', attack: 'atk', def: 'def', defense: 'def',
    spatk: 'spa', specialattack: 'spa', spa: 'spa',
    spdef: 'spd', specialdefense: 'spd', spd: 'spd',
    spe: 'spe', speed: 'spe',
  }[cleaned] || null);
}

function parseNature(raw) {
  const match = String(raw || '').match(/^[A-Za-z]+/);
  return match ? match[0] : null;
}

function parseEvSpread(raw) {
  if (!raw) return {};
  const evs = {};
  const text = String(raw);
  for (const match of text.matchAll(/([A-Za-z. ]+?)\s*(\d{1,3})/g)) {
    const statKey = toCalcStat(match[1]);
    if (statKey) evs[statKey] = Number(match[2]);
  }
  for (const match of text.matchAll(/(\d{1,3})\s*([A-Za-z. ]+)/g)) {
    const statKey = toCalcStat(match[2]);
    if (statKey) evs[statKey] = Number(match[1]);
  }
  return evs;
}

function parseSlashSpread(raw) {
  const [nature, values] = String(raw || '').split(/\s+/, 2);
  if (!nature || !values) return null;
  const [hp, atk, def, spa, spd, spe] = values.split('/').map(Number);
  if ([hp, atk, def, spa, spd, spe].some(Number.isNaN)) return null;
  return { label: raw, nature, evs: { hp, atk, def, spa, spd, spe } };
}

function matchSegment(text, label, endMarkers) {
  const labelPattern = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const endPattern = endMarkers.map((marker) => marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`${labelPattern}\\s+([\\s\\S]*?)(?=${endPattern}|$)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function aggregateCounts(items) {
  const counts = new Map();
  items.filter(Boolean).forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
}

function canonicalEnglishName(name, kind) {
  if (!name) return null;
  const candidate = ENGLISH_OVERRIDES[kind]?.[normalizeName(name)] || name;
  const lookup = kind === 'items' ? VALID_ITEMS : kind === 'moves' ? VALID_MOVES : VALID_ABILITIES;
  return lookup.get(toID(candidate)) || null;
}

function filterCanonicalEntries(entries, kind) {
  const merged = new Map();
  (entries || [])
    .map((entry) => {
      const canonical = canonicalEnglishName(entry.name, kind);
      return canonical ? { ...entry, name: canonical } : null;
    })
    .filter(Boolean)
    .forEach((entry) => {
      const existing = merged.get(entry.name);
      if (existing) existing.percent += entry.percent;
      else merged.set(entry.name, { ...entry });
    });
  return [...merged.values()].sort((a, b) => b.percent - a.percent);
}

function formatDisplaySpeciesName(name) {
  return String(name || '').split(/[- ]+/).filter(Boolean).map((part) => (part.length <= 2 ? part.toUpperCase() : capitalizeWord(part))).join(' ');
}

function pageAppearsToMatchPokemon(pageTitle, pokemonName) {
  const title = normalizeName(pageTitle);
  return normalizeLookupAliases(pokemonName).some((alias) => title.includes(alias));
}

function parseSimpleUsageSection(sectionText) {
  const entries = [];
  const regex = /([\p{L}\p{N}.'’\-:/ ]+?)\s+(\d+\.\d+)%/gu;
  let match = regex.exec(sectionText);
  while (match) {
    if (match[1].trim() && match[1].trim().toLowerCase() !== 'other') entries.push({ name: match[1].trim(), percent: Number(match[2]) });
    match = regex.exec(sectionText);
  }
  return entries;
}

function parseMoveUsageSection(sectionText) {
  const entries = [];
  const regex = new RegExp(`([\\p{L}\\p{N}.'’\\-: ]+?)\\s+(?:${MOVE_TYPES.join('|')})\\s+(\\d+\\.\\d+)%`, 'giu');
  let match = regex.exec(sectionText);
  while (match) {
    if (match[1].trim() && match[1].trim().toLowerCase() !== 'other') entries.push({ name: match[1].trim(), percent: Number(match[2]) });
    match = regex.exec(sectionText);
  }
  return entries;
}

function topEntry(entries) {
  return entries?.length ? entries[0] : null;
}

function getUsableUsageMoves(usage) {
  return (usage?.moves || []).filter((entry) => entry.percent >= MIN_USAGE_MOVE_PERCENT);
}

function toCalcSpeciesName(pokemon) {
  if (pokemon?.calcName) return pokemon.calcName;
  const special = {
    'indeedee-female': 'Indeedee-F',
    'indeedee-male': 'Indeedee-M',
    'ursaluna-bloodmoon': 'Ursaluna-Bloodmoon',
    'urshifu-rapid-strike': 'Urshifu-Rapid-Strike',
    'urshifu-single-strike': 'Urshifu-Single-Strike',
    'ogerpon-hearthflame-mask': 'Ogerpon-Hearthflame',
    'ogerpon-cornerstone-mask': 'Ogerpon-Cornerstone',
    'ogerpon-wellspring-mask': 'Ogerpon-Wellspring',
    'landorus-therian': 'Landorus-Therian',
    'landorus-incarnate': 'Landorus',
    'tornadus-incarnate': 'Tornadus',
  };
  return special[String(pokemon?.apiName || '')] || String(pokemon?.name || '');
}

function getPikalyticsCandidates(pokemon) {
  const rawCandidates = new Set();
  const displayName = pokemon?.name || pokemon;
  const apiName = pokemon?.apiName || pokemon;
  rawCandidates.add(String(displayName || ''));
  rawCandidates.add(String(apiName || ''));
  normalizeLookupAliases(displayName).forEach((candidate) => rawCandidates.add(candidate));
  normalizeLookupAliases(apiName).forEach((candidate) => rawCandidates.add(candidate));
  const special = {
    'indeedee-female': ['Indeedee-F'],
    'indeedee-male': ['Indeedee-M'],
    'ursaluna-bloodmoon': ['Ursaluna-Bloodmoon'],
    'urshifu-rapid-strike': ['Urshifu-Rapid-Strike'],
    'urshifu-single-strike': ['Urshifu-Single-Strike'],
    'ogerpon-hearthflame-mask': ['Ogerpon-Hearthflame'],
    'ogerpon-cornerstone-mask': ['Ogerpon-Cornerstone'],
    'ogerpon-wellspring-mask': ['Ogerpon-Wellspring'],
    'landorus-therian': ['Landorus-Therian'],
    'landorus-incarnate': ['Landorus'],
  };
  (special[String(apiName)] || []).forEach((candidate) => rawCandidates.add(candidate));
  return [...rawCandidates].map((candidate) => String(candidate || '').replace(/_/g, ' ').split(/[ -]+/).filter(Boolean).map(capitalizeWord).join(' ').replace(/\bF\b/, 'F').replace(/\bM\b/, 'M')).filter(Boolean);
}

function extractSvGame8Fields(tableText) {
  const flattened = tableText.replace(/\s+/g, ' ').trim();
  const fields = {
    nature: matchSegment(flattened, 'Nature', ['EV Spread', 'Ability', 'Held Item', 'Moveset']),
    evSpread: matchSegment(flattened, 'EV Spread', ['Final Stat Values', 'Ability', 'Held Item', 'Moveset']),
    finalStats: matchSegment(flattened, 'Final Stat Values', ['Ability', 'Tera Type', 'Held Item', 'Moveset']),
    ability: matchSegment(flattened, 'Ability', ['Tera Type', 'Held Item', 'Moveset']),
    teraType: matchSegment(flattened, 'Tera Type', ['Held Item', 'Moveset']),
    heldItem: matchSegment(flattened, 'Held Item', ['Moveset']),
  };
  const moveMatch = flattened.match(/Moveset\s+(.+)/i);
  fields.moves = moveMatch ? moveMatch[1].split(/・/).map((entry) => entry.trim()).filter(Boolean).slice(0, 4) : [];
  return fields;
}

function parseChampionsGame8Fields(tableText) {
  const text = tableText.replace(/\s+/g, ' ').trim();
  const fields = { nature: matchSegment(text, 'Nature', ['Ability', 'Held Item']), ability: null, heldItem: null, finalStats: null, evSpread: null, moves: [] };
  const abilityMatch = text.match(/Ability\s+(.+?)\s+\1\s+/i);
  if (abilityMatch) fields.ability = abilityMatch[1].trim();
  const itemMatch = text.match(/Held Item\s+(.+?)\s+\1\s+/i);
  if (itemMatch) fields.heldItem = itemMatch[1].trim();
  const statMatch = text.match(/HP Atk Def SpA SpD Spe\s+(.+?)\s+Moves\b/i);
  if (statMatch) {
    const tokens = statMatch[1].trim().split(/\s+/);
    if (tokens.length >= 12) {
      const finals = tokens.slice(0, 6);
      const evs = tokens.slice(6, 12);
      fields.finalStats = `HP ${finals[0]} / Atk ${finals[1]} / Def ${finals[2]} / SpA ${finals[3]} / SpD ${finals[4]} / Spe ${finals[5]}`;
      fields.evSpread = [evs[0] !== '-' ? `${evs[0]} HP` : null, evs[1] !== '-' ? `${evs[1]} Atk` : null, evs[2] !== '-' ? `${evs[2]} Def` : null, evs[3] !== '-' ? `${evs[3]} SpA` : null, evs[4] !== '-' ? `${evs[4]} SpD` : null, evs[5] !== '-' ? `${evs[5]} Spe` : null].filter(Boolean).join(' / ');
    }
  }
  const moveMatches = [...text.matchAll(/([A-Za-z][A-Za-z' -]+?)\s+\1\s+Type\b/g)];
  fields.moves = moveMatches.map((match) => match[1].trim()).filter((name, index, arr) => arr.indexOf(name) === index).slice(0, 4);
  return fields;
}

function parseGame8BuildPage(html, sourceUrl, sourceKey) {
  const $ = cheerio.load(html);
  const pageTitle = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || 'Game8 Build';
  const updatedAt = $('time').first().text().replace(/\s+/g, ' ').trim() || null;
  const builds = [];
  const buildsHeading = $('h2').filter((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    return sourceKey === 'champions' ? text.startsWith('Best Builds for') : text.startsWith('Doubles Movesets');
  }).first();
  if (!buildsHeading.length) return { title: pageTitle, updatedAt, sourceUrl, sourceGame: sourceKey === 'champions' ? 'Pokemon Champions' : 'Scarlet and Violet', builds: [], commonMoves: [], commonItems: [], commonSpreads: [] };
  let cursor = buildsHeading.next();
  while (cursor.length) {
    if (cursor[0].tagName === 'h2') break;
    if (cursor[0].tagName === 'h3') {
      const buildName = cursor.text().replace(/\s+/g, ' ').trim();
      const nodes = [];
      let sectionCursor = cursor.next();
      while (sectionCursor.length) {
        if (['h2', 'h3'].includes(sectionCursor[0].tagName)) break;
        nodes.push(sectionCursor);
        sectionCursor = sectionCursor.next();
      }
      const tableNode = nodes.find((node) => node[0].tagName === 'table' && /Nature\s+/i.test(node.text()));
      if (tableNode) {
        const summaryHeadingIndex = nodes.findIndex((node) => node[0].tagName === 'h4' && /Summary/i.test(node.text()));
        const summaryNode = summaryHeadingIndex >= 0 ? nodes.slice(summaryHeadingIndex + 1).find((node) => /^(p|table)$/i.test(node[0].tagName)) : null;
        const paragraphs = nodes.filter((node) => node[0].tagName === 'p').map((node) => node.text().replace(/\s+/g, ' ').trim()).filter(Boolean);
        const fields = sourceKey === 'champions' ? parseChampionsGame8Fields(tableNode.text()) : extractSvGame8Fields(tableNode.text());
        builds.push({
          name: buildName,
          nature: parseNature(fields.nature),
          natureLabel: fields.nature || null,
          evSpread: fields.evSpread || null,
          evs: parseEvSpread(fields.evSpread),
          finalStats: fields.finalStats || null,
          ability: fields.ability || null,
          teraType: fields.teraType || null,
          heldItem: fields.heldItem || null,
          moves: fields.moves || [],
          summary: summaryNode?.text().replace(/\s+/g, ' ').trim() || paragraphs.slice(0, 2).join(' '),
        });
      }
      cursor = sectionCursor;
      continue;
    }
    cursor = cursor.next();
  }
  return {
    title: pageTitle,
    updatedAt,
    sourceUrl,
    sourceGame: sourceKey === 'champions' ? 'Pokemon Champions' : 'Scarlet and Violet',
    builds,
    commonMoves: aggregateCounts(builds.flatMap((build) => build.moves)),
    commonItems: aggregateCounts(builds.map((build) => build.heldItem)),
    commonSpreads: aggregateCounts(builds.map((build) => build.evSpread)),
  };
}

function buildPikalyticsIndexAliases(name, slug) {
  const aliases = new Set();
  normalizeLookupAliases(name).forEach((alias) => aliases.add(alias));
  normalizeLookupAliases(slug).forEach((alias) => aliases.add(alias));
  aliases.add(normalizeName(name));
  aliases.add(normalizeName(slug));
  return [...aliases].filter(Boolean);
}

function parsePikalyticsUsage(html, sourceUrl, pageName, sourceKey) {
  const bodyText = cheerio.load(html)('body').text().replace(/\s+/g, ' ').trim();
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  const metaDescription = $('meta[name="Description"]').attr('content') || '';
  const usageRateMatch = metaDescription.match(/(\d+)% usage rate/i);
  return {
    title,
    sourceUrl,
    format: PIKALYTICS_SOURCES[sourceKey].label,
    sourceKey,
    usageRate: usageRateMatch ? Number(usageRateMatch[1]) : null,
    moves: filterCanonicalEntries(parseMoveUsageSection(matchSegment(bodyText, `Best Moves for ${pageName}`, [`Best Teammates for ${pageName}`, `Best Items for ${pageName}`])), 'moves'),
    items: filterCanonicalEntries(parseSimpleUsageSection(matchSegment(bodyText, `Best Items for ${pageName}`, [`Best Abilities for ${pageName}`, `Best EV Spreads for ${pageName}`, `${pageName} Pokemon Champions Teams`])), 'items'),
    abilities: filterCanonicalEntries(parseSimpleUsageSection(matchSegment(bodyText, `Best Abilities for ${pageName}`, [`Best EV Spreads for ${pageName}`, `${pageName} Pokemon Champions Teams`, 'Frequently Asked Questions'])), 'abilities'),
    spreads: parseSimpleUsageSection(matchSegment(bodyText, `Best EV Spreads for ${pageName}`, ['Frequently Asked Questions', `${pageName} Pokemon Champions Teams`])).map((entry) => ({ ...entry, parsed: parseSlashSpread(entry.name) })),
  };
}

function createPokemonProvider(context) {
  return {
    async get(query) {
      const key = String(query || '').trim().toLowerCase();
      if (context.pokemon.has(key)) return context.pokemon.get(key);
      const normalizedKey = key.replace(/\s+/g, '-');
      const endpoint = /^\d+$/.test(key) ? `https://pokeapi.co/api/v2/pokemon/${key}` : `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(normalizedKey)}`;
      const data = await fetchJson(endpoint);
      const abilities = await Promise.all(
        data.abilities
          .sort((a, b) => a.slot - b.slot)
          .map(async (abilityEntry) => ({
            name: displayNameFromApiName(abilityEntry.ability.name),
            description: await getAbilityDescription(context, abilityEntry.ability.url),
            isHidden: abilityEntry.is_hidden,
          }))
      );

      const pokemon = {
        id: data.id,
        apiName: data.name,
        name: displayNameFromApiName(data.name),
        calcName: toCalcSpeciesName({ apiName: data.name, name: displayNameFromApiName(data.name) }),
        sprite: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default || null,
        types: data.types.sort((a, b) => a.slot - b.slot).map((typeEntry) => capitalizeWord(typeEntry.type.name)),
        abilities,
        stats: data.stats.map((statEntry) => ({ name: formatStatName(statEntry.stat.name), key: statEntry.stat.name, value: statEntry.base_stat })),
      };
      context.pokemon.set(key, pokemon);
      context.pokemon.set(String(data.id), pokemon);
      context.pokemon.set(data.name.toLowerCase(), pokemon);
      return pokemon;
    },
  };
}

function createBuildProvider(context) {
  return {
    async getIndex(sourceKey) {
      const now = Date.now();
      const cached = context.game8Indexes.get(sourceKey);
      const fetchedAt = context.game8IndexFetchedAt.get(sourceKey) || 0;
      if (cached && now - fetchedAt < 12 * 60 * 60 * 1000) return cached;
      const html = await fetchText(GAME8_INDEXES[sourceKey]);
      const $ = cheerio.load(html);
      const entries = new Map();
      const entryList = [];
      $('a[href*="/games/"]').each((_, element) => {
        const text = $(element).text().replace(/\s+/g, ' ').trim();
        const href = $(element).attr('href');
        if (!href) return;
        if (sourceKey === 'champions' && !/movesets and best builds|team|mega|charizardite|garchompite/i.test(text)) return;
        if (sourceKey === 'sv' && !/Best Doubles Moveset/i.test(text)) return;
        const cleanedText = text.replace(/^▶️\s*/u, '').replace(/\s+Movesets and Best Builds$/i, '').replace(/\s+Best Doubles Movesets?$/i, '').trim();
        if (!cleanedText) return;
        const absoluteUrl = new URL(href, 'https://game8.co').toString().split('#')[0];
        const entry = { name: cleanedText, url: absoluteUrl };
        entryList.push(entry);
        normalizeLookupAliases(cleanedText).forEach((alias) => entries.set(alias, entry));
      });
      context.game8Indexes.set(sourceKey, entries);
      context.game8Entries.set(sourceKey, entryList);
      context.game8IndexFetchedAt.set(sourceKey, now);
      return entries;
    },
    async getBuildData(pokemonName, preferredSource = 'champions') {
      const order = preferredSource === 'sv' ? ['sv', 'champions'] : ['champions', 'sv'];
      for (const sourceKey of order) {
        const index = await this.getIndex(sourceKey);
        const aliases = normalizeLookupAliases(pokemonName);
        let candidates = aliases.map((alias) => index.get(alias)).filter(Boolean);
        if (!candidates.length && sourceKey === 'champions') {
          const allEntries = context.game8Entries.get(sourceKey) || [];
          const aliasSet = new Set(aliases);
          candidates = allEntries.filter((entry) => {
            const normalizedEntry = normalizeName(entry.name);
            return [...aliasSet].some((alias) => normalizedEntry.includes(alias) || alias.includes(normalizedEntry));
          });
        }
        if (!candidates.length) continue;
        const deduped = [];
        const seenUrls = new Set();
        candidates.forEach((entry) => {
          if (!seenUrls.has(entry.url)) {
            seenUrls.add(entry.url);
            deduped.push(entry);
          }
        });
        for (const entry of deduped) {
          if (context.game8Pages.has(entry.url)) return context.game8Pages.get(entry.url);
          const html = await fetchText(entry.url);
          const parsed = parseGame8BuildPage(html, entry.url, sourceKey);
          if (!pageAppearsToMatchPokemon(parsed.title, pokemonName)) continue;
          context.game8Pages.set(entry.url, parsed);
          return parsed;
        }
      }
      return null;
    },
  };
}

function createUsageProvider(context) {
  return {
    async getIndex(sourceKey) {
      const now = Date.now();
      const cached = context.pikalyticsIndexes.get(sourceKey);
      const fetchedAt = context.pikalyticsIndexFetchedAt.get(sourceKey) || 0;
      if (cached && now - fetchedAt < 6 * 60 * 60 * 1000) return cached;
      const source = PIKALYTICS_SOURCES[sourceKey];
      const html = await fetchText(source.indexUrl);
      const $ = cheerio.load(html);
      const entries = new Map();
      $(`a[href*="${source.linkPattern}"]`).each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;
        const cleanHref = href.split('?')[0];
        const parts = cleanHref.split('/').filter(Boolean);
        const slug = decodeURIComponent(parts[parts.length - 1] || '');
        const usageText = $(element).text().replace(/\s+/g, ' ').trim();
        const usageMatch = usageText.match(/(\d+\.\d+)%/);
        if (!slug || !usageMatch) return;
        const entry = {
          name: slug.replace(/-/g, ' '),
          calcName: slug,
          usage: Number(usageMatch[1]),
          sourceUrl: `${new URL(cleanHref, 'https://pikalytics.com').toString()}?l=en`,
          sourceKey,
          sourceLabel: source.label,
        };
        buildPikalyticsIndexAliases(entry.name, slug).forEach((alias) => {
          if (!entries.has(alias)) entries.set(alias, entry);
        });
      });
      context.pikalyticsIndexes.set(sourceKey, entries);
      context.pikalyticsIndexFetchedAt.set(sourceKey, now);
      return entries;
    },
    async getTopPokemon(sourceKey) {
      const now = Date.now();
      const cached = context.pikalyticsTop.get(sourceKey);
      const fetchedAt = context.pikalyticsTopFetchedAt.get(sourceKey) || 0;
      if (cached && now - fetchedAt < 6 * 60 * 60 * 1000) return cached;
      const source = PIKALYTICS_SOURCES[sourceKey];
      const html = await fetchText(source.topUrl);
      const $ = cheerio.load(html);
      const results = [];
      const seen = new Set();
      $(`a[href*="${source.linkPattern}"]`).each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;
        const cleanHref = href.split('?')[0];
        const parts = cleanHref.split('/').filter(Boolean);
        const slug = decodeURIComponent(parts[parts.length - 1] || '');
        const usageText = $(element).text().replace(/\s+/g, ' ').trim();
        const usageMatch = usageText.match(/(\d+\.\d+)%/);
        if (!slug || !usageMatch || seen.has(slug)) return;
        seen.add(slug);
        results.push({ name: slug.replace(/-/g, ' '), calcName: slug, usage: Number(usageMatch[1]), sourceUrl: `${new URL(cleanHref, 'https://pikalytics.com').toString()}?l=en`, sourceKey, sourceLabel: source.label });
      });
      context.pikalyticsTop.set(sourceKey, results);
      context.pikalyticsTopFetchedAt.set(sourceKey, now);
      return results;
    },
    async getUsageData(pokemon) {
      for (const sourceKey of ['champions', 'sv']) {
        const index = await this.getIndex(sourceKey);
        const entry = [
          ...(pokemon?.name ? normalizeLookupAliases(pokemon.name) : []),
          ...(pokemon?.apiName ? normalizeLookupAliases(pokemon.apiName) : []),
          ...(pokemon?.calcName ? normalizeLookupAliases(pokemon.calcName) : []),
          ...normalizeLookupAliases(pokemon.name || pokemon),
        ].map((alias) => index.get(alias)).find(Boolean);
        if (entry) {
          if (context.pikalyticsPages.has(entry.sourceUrl)) return context.pikalyticsPages.get(entry.sourceUrl);
          try {
            const html = await fetchText(entry.sourceUrl);
            const parsed = parsePikalyticsUsage(html, entry.sourceUrl, entry.name, sourceKey);
            parsed.calcName = entry.calcName;
            context.pikalyticsPages.set(entry.sourceUrl, parsed);
            return parsed;
          } catch {
            continue;
          }
        }
        if (sourceKey === 'sv') {
          for (const candidate of getPikalyticsCandidates(pokemon)) {
            const url = `https://pikalytics.com/pokedex/gen9vgc2026regf/${encodeURIComponent(candidate)}?l=en`;
            if (context.pikalyticsPages.has(url)) return context.pikalyticsPages.get(url);
            try {
              const html = await fetchText(url);
              const parsed = parsePikalyticsUsage(html, url, candidate, sourceKey);
              parsed.calcName = candidate.replace(/ /g, '-');
              context.pikalyticsPages.set(url, parsed);
              return parsed;
            } catch {
              continue;
            }
          }
        }
      }
      return null;
    },
  };
}

function buildUsageSet(pokemon, usage, fallbackBuild) {
  const topSpread = topEntry(usage?.spreads);
  const topItem = topEntry(usage?.items);
  const topAbility = topEntry(usage?.abilities);
  const spread = topSpread?.parsed;
  const fallback = fallbackBuild?.builds?.[0];
  return {
    name: pokemon.name,
    calcName: pokemon.calcName || toCalcSpeciesName(pokemon),
    level: DEFAULT_LEVEL,
    nature: spread?.nature || fallback?.nature || 'Serious',
    item: topItem?.name || fallback?.heldItem,
    ability: topAbility?.name || fallback?.ability,
    evs: spread?.evs || fallback?.evs || {},
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  };
}

function createPokemonForCalc(build) {
  const options = {
    level: build.level || DEFAULT_LEVEL,
    evs: build.evs || {},
    item: build.item || undefined,
    nature: build.nature || undefined,
    ability: build.ability || undefined,
    ivs: build.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  };
  if (build.teraType) options.teraType = build.teraType;
  if (build.status) options.status = build.status;
  if (build.boosts) options.boosts = build.boosts;
  return new Pokemon(gen, build.calcName || build.name, options);
}

function calculateMoveSummary(attackerBuild, defenderBuild, moveName) {
  try {
    const attacker = createPokemonForCalc(attackerBuild);
    const defender = createPokemonForCalc(defenderBuild);
    const move = new Move(gen, moveName);
    const field = new Field({ gameType: 'Doubles' });
    const result = calculate(gen, attacker, defender, move, field);
    const [min, max] = result.range();
    if (max === 0) return null;
    return { move: moveName, summary: result.desc(), min, max };
  } catch {
    return null;
  }
}

function selectBestDamageLines(attackerBuild, defenderBuild, moves, count = 2) {
  return moves.map((move) => calculateMoveSummary(attackerBuild, defenderBuild, move.name || move)).filter(Boolean).sort((a, b) => b.max - a.max).slice(0, count);
}

function createCalcProvider() {
  return {
    calculateDamage(attacker, defender, moveName, options = {}) {
      const move = new Move(gen, moveName, { isCrit: Boolean(options.isCrit) });
      const attackerSide = {};
      const defenderSide = {};
      if (options.isHelpingHand) attackerSide.isHelpingHand = true;
      if (options.isReflect) defenderSide.isReflect = true;
      if (options.isLightScreen) defenderSide.isLightScreen = true;
      const field = new Field({
        gameType: 'Doubles',
        weather: options.weather || undefined,
        terrain: options.terrain || undefined,
        attackerSide,
        defenderSide,
      });
      const result = calculate(gen, createPokemonForCalc(attacker), createPokemonForCalc(defender), move, field);
      const [min, max] = result.range();
      return { summary: result.desc(), min, max };
    },
  };
}

function createReferenceService({ pokemonProvider, usageProvider, buildProvider, calcProvider }) {
  return {
    async lookupPokemon(query) {
      const pokemon = await pokemonProvider.get(query);
      const [game8, usage] = await Promise.all([buildProvider.getBuildData(pokemon.apiName), usageProvider.getUsageData(pokemon)]);
      const quickCalcs = usage ? await this.buildQuickCalcs(pokemon, usage, game8) : [];
      return { pokemon, game8, usage, quickCalcs };
    },
    async buildQuickCalcs(subjectPokemon, subjectUsage, subjectGame8) {
      const subjectMoves = getUsableUsageMoves(subjectUsage);
      if (!subjectMoves.length) return [];
      const sourceKey = subjectUsage.sourceKey || 'sv';
      const topMeta = await usageProvider.getTopPokemon(sourceKey);
      const subjectBuild = buildUsageSet(subjectPokemon, subjectUsage, subjectGame8);
      const subjectNameKey = normalizeName(subjectPokemon.name);
      const opponents = [];
      for (const entry of topMeta) {
        if (normalizeName(entry.name) === subjectNameKey) continue;
        opponents.push(entry);
        if (opponents.length >= 5) break;
      }
      const rows = [];
      for (const opponent of opponents) {
        const defenderPokemon = { name: formatDisplaySpeciesName(opponent.name), apiName: opponent.calcName.toLowerCase().replace(/ /g, '-'), calcName: opponent.calcName };
        const defenderUsage = await usageProvider.getUsageData(defenderPokemon);
        const defenderGame8 = await buildProvider.getBuildData(defenderPokemon.name, sourceKey);
        const defenderMoves = getUsableUsageMoves(defenderUsage);
        if (!defenderMoves.length) continue;
        const defenderBuild = buildUsageSet(defenderPokemon, defenderUsage, defenderGame8);
        const offense = selectBestDamageLines(subjectBuild, defenderBuild, subjectMoves.slice(0, 4), 2);
        const returnPressure = selectBestDamageLines(defenderBuild, subjectBuild, defenderMoves.slice(0, 4), 1);
        rows.push({
          defender: {
            name: defenderPokemon.name,
            usage: opponent.usage,
            item: topEntry(defenderUsage.items)?.name || null,
            spread: topEntry(defenderUsage.spreads)?.name || null,
          },
          offense,
          returnPressure: returnPressure[0] || null,
        });
      }
      return rows;
    },
    calculateDamage: calcProvider.calculateDamage,
  };
}

function createProviders() {
  const context = createBaseContext();
  const pokemonProvider = createPokemonProvider(context);
  const buildProvider = createBuildProvider(context);
  const usageProvider = createUsageProvider(context);
  const calcProvider = createCalcProvider();
  const referenceService = createReferenceService({ pokemonProvider, usageProvider, buildProvider, calcProvider });
  return {
    pokemonProvider,
    buildProvider,
    usageProvider,
    calcProvider,
    referenceService,
  };
}

module.exports = {
  createProviders,
};
