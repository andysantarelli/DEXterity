const lookupForm = document.querySelector('#lookup-form');
const queryInput = document.querySelector('#pokemon-query');
const lookupStatus = document.querySelector('#lookup-status');
const pokemonPanel = document.querySelector('#pokemon-panel');
const attackerNameInput = document.querySelector('#attacker-name');
const attackerBuildSelect = document.querySelector('#attacker-build');
const defenderNameInput = document.querySelector('#defender-name');
const defenderBuildSelect = document.querySelector('#defender-build');
const moveSelect = document.querySelector('#move-select');
const calcStatus = document.querySelector('#calc-status');
const calcResult = document.querySelector('#calc-result');
const loadDefenderButton = document.querySelector('#load-defender');
const runCalcButton = document.querySelector('#run-calc');
const weatherSelect = document.querySelector('#calc-weather');
const terrainSelect = document.querySelector('#calc-terrain');
const attackerStageSelect = document.querySelector('#attacker-stage');
const defenderStageSelect = document.querySelector('#defender-stage');
const helpingHandInput = document.querySelector('#calc-helping-hand');
const burnedInput = document.querySelector('#calc-burned');
const reflectInput = document.querySelector('#calc-reflect');
const lightScreenInput = document.querySelector('#calc-light-screen');
const critInput = document.querySelector('#calc-crit');

const state = {
  currentLookup: null,
  attacker: null,
  defender: null,
};
const MIN_USAGE_MOVE_PERCENT = 1;
const MIN_USAGE_ITEM_PERCENT = 1;

for (let stage = 6; stage >= -6; stage -= 1) {
  const label = stage > 0 ? `+${stage}` : `${stage}`;
  const selected = stage === 0 ? ' selected' : '';
  attackerStageSelect.insertAdjacentHTML('beforeend', `<option value="${stage}"${selected}>${label}</option>`);
  defenderStageSelect.insertAdjacentHTML('beforeend', `<option value="${stage}"${selected}>${label}</option>`);
}

function setLookupStatus(message, isError = false) {
  lookupStatus.textContent = message;
  lookupStatus.style.color = isError ? '#8a2818' : '';
}

function setCalcStatus(message, isError = false) {
  calcStatus.textContent = message;
  calcStatus.style.color = isError ? '#8a2818' : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOptionsMarkup(source) {
  const options = ['<option value="">Usage default</option>'];
  (source?.game8?.builds || []).forEach((build, index) => {
    options.push(
      `<option value="game8:${index}">${escapeHtml(build.name.replace(' Moveset & Best Build', ''))}</option>`
    );
  });
  return options.join('');
}

function renderPercentRows(items, emptyLabel, limit = 4) {
  if (!items?.length) {
    return `<div class="summary-row"><span>${escapeHtml(emptyLabel)}</span><strong>-</strong></div>`;
  }

  return items
    .slice(0, limit)
    .map(
      (item) => `
        <div class="summary-row">
          <span>${escapeHtml(item.name)}</span>
          <strong>${
            item.isFallback
              ? escapeHtml(String(item.percent))
              : `${escapeHtml(item.percent.toFixed(1))}%`
          }</strong>
        </div>
      `
    )
    .join('');
}

function getUsableUsageMoves(usage) {
  return (usage?.moves || []).filter((item) => item.percent >= MIN_USAGE_MOVE_PERCENT);
}

function getUsableUsageItems(usage) {
  return (usage?.items || []).filter((item) => item.percent >= MIN_USAGE_ITEM_PERCENT);
}

function getDisplayedCommonMoves(usage, game8) {
  const usageMoves = getUsableUsageMoves(usage);
  if (usageMoves.length) {
    return {
      items: usageMoves,
      label: usage?.format ? `${usage.format} usage` : 'Usage data',
    };
  }
  return {
    items: [],
    label: usage?.format ? `${usage.format} usage` : 'Pikalytics usage',
  };
}

function getDisplayedCommonItems(usage, game8) {
  const usageItems = getUsableUsageItems(usage);
  if (usageItems.length) {
    return {
      items: usageItems,
      label: usage?.format ? `${usage.format} usage` : 'Usage data',
    };
  }
  return {
    items: [],
    label: usage?.format ? `${usage.format} usage` : 'Usage data',
  };
}

function getDisplayedCommonSpreads(usage, game8) {
  const usageSpreads = usage?.spreads || [];
  if (usageSpreads.length) {
    return {
      items: usageSpreads,
      label: usage?.format ? `${usage.format} usage` : 'Usage data',
    };
  }

  const fallbackSpreads = (game8?.commonSpreads || []).map((item) => ({
    name: item.name,
    percent: item.count,
    isFallback: true,
  }));

  return {
    items: fallbackSpreads,
    label: game8?.sourceGame ? `${game8.sourceGame} Game8 builds` : 'Game8 build data',
  };
}

function renderCountRows(items, emptyLabel) {
  if (!items?.length) {
    return `<div class="summary-row"><span>${escapeHtml(emptyLabel)}</span><strong>-</strong></div>`;
  }

  return items
    .slice(0, 4)
    .map(
      (item) => `
        <div class="summary-row">
          <span>${escapeHtml(item.name)}</span>
          <strong>${escapeHtml(String(item.count))}</strong>
        </div>
      `
    )
    .join('');
}

function renderBuilds(builds) {
  if (!builds?.length) {
    return `
      <div class="build-card">
        <p class="build-summary">No Game8 doubles build was found for this Pokemon right now.</p>
      </div>
    `;
  }

  return builds
    .map(
      (build) => `
        <article class="build-card">
          <h3>${escapeHtml(build.name)}</h3>
          <div class="move-chips">
            ${build.moves.map((move) => `<span class="move-chip">${escapeHtml(move)}</span>`).join('')}
          </div>
          <div class="build-meta">
            <div>
              <strong>Item</strong>
              <p>${escapeHtml(build.heldItem || 'Not listed')}</p>
            </div>
            <div>
              <strong>Nature</strong>
              <p>${escapeHtml(build.natureLabel || 'Not listed')}</p>
            </div>
            <div>
              <strong>EVs</strong>
              <p>${escapeHtml(build.evSpread || 'Not listed')}</p>
            </div>
            <div>
              <strong>Ability</strong>
              <p>${escapeHtml(build.ability || 'Not listed')}</p>
            </div>
          </div>
          <p class="build-summary">${escapeHtml(build.summary || 'Game8 summary unavailable.')}</p>
        </article>
      `
    )
    .join('');
}

function typeClassName(type) {
  return `type-${String(type || '').toLowerCase()}`;
}

function renderAbilities(abilities) {
  if (!abilities?.length) {
    return '<div class="ability-card"><p class="build-summary">No ability details found.</p></div>';
  }

  return abilities
    .map(
      (ability) => `
        <article class="ability-card">
          <div class="ability-head">
            <strong>${escapeHtml(ability.name)}</strong>
            ${ability.isHidden ? '<span class="ability-tag">Hidden</span>' : ''}
          </div>
          <p>${escapeHtml(ability.description)}</p>
        </article>
      `
    )
    .join('');
}

function renderQuickCalcs(rows) {
  if (!rows?.length) {
    return `
      <div class="matchup-card">
        <p class="build-summary">Automatic matchup calcs are unavailable when usage data is missing.</p>
      </div>
    `;
  }

  return rows
    .map(
      (row) => `
        <article class="matchup-card">
          <div class="matchup-head">
            <div>
              <h3>${escapeHtml(row.defender.name)}</h3>
              <p>${escapeHtml(row.defender.usage.toFixed(1))}% usage</p>
            </div>
            <div class="matchup-meta">
              <span>${escapeHtml(row.defender.item || 'No item')}</span>
              <span>${escapeHtml(row.defender.spread || 'No spread')}</span>
            </div>
          </div>
          <div class="matchup-lines">
            ${row.offense
              .map(
                (line) => `
                  <div class="matchup-line">
                    <strong>${escapeHtml(line.move)}</strong>
                    <p>${escapeHtml(line.summary)}</p>
                  </div>
                `
              )
              .join('')}
            ${
              row.returnPressure
                ? `
                  <div class="matchup-line threat-line">
                    <strong>Back: ${escapeHtml(row.returnPressure.move)}</strong>
                    <p>${escapeHtml(row.returnPressure.summary)}</p>
                  </div>
                `
                : ''
            }
          </div>
        </article>
      `
    )
    .join('');
}

function renderSourceLinks(usage, game8) {
  const links = [];

  if (usage?.sourceUrl) {
    links.push(`
      <a class="source-link" href="${escapeHtml(usage.sourceUrl)}" target="_blank" rel="noreferrer">
        Pikalytics
      </a>
    `);
  }

  if (game8?.sourceUrl) {
    links.push(`
      <a class="source-link" href="${escapeHtml(game8.sourceUrl)}" target="_blank" rel="noreferrer">
        Game8
      </a>
    `);
  }

  if (!links.length) return '';

  return `
    <div class="source-links">
      ${links.join('')}
    </div>
  `;
}

function renderPokemonPanel(data) {
  const { pokemon, game8, usage, quickCalcs } = data;
  const commonMoves = getDisplayedCommonMoves(usage);
  const commonItems = getDisplayedCommonItems(usage, game8);
  const commonSpreads = getDisplayedCommonSpreads(usage, game8);
  const statsMarkup = pokemon.stats
    .map(
      (stat) => `
        <div class="stat-row">
          <span>${escapeHtml(stat.name)}</span>
          <strong>${escapeHtml(String(stat.value))}</strong>
        </div>
      `
    )
    .join('');

  pokemonPanel.innerHTML = `
    <div class="pokemon-head">
      <img src="${escapeHtml(pokemon.sprite || '')}" alt="${escapeHtml(pokemon.name)} artwork" />
      <div>
        <p class="eyebrow">#${escapeHtml(String(pokemon.id))}</p>
        <h2>${escapeHtml(pokemon.name)}</h2>
        <div class="pokemon-meta">
          ${pokemon.types.map((type) => `<span class="pill ${typeClassName(type)}">${escapeHtml(type)}</span>`).join('')}
        </div>
        ${renderSourceLinks(usage, game8)}
      </div>
    </div>

    <div class="data-grid">
      <section class="mini-panel">
        <p class="eyebrow">Base Stats</p>
        <div class="stat-list">${statsMarkup}</div>
      </section>
      <section class="mini-panel">
        <p class="eyebrow">Abilities</p>
        <div class="ability-list">${renderAbilities(pokemon.abilities)}</div>
      </section>
      <section class="mini-panel">
        <p class="eyebrow">Common Moves</p>
        <div class="summary-list">${renderPercentRows(commonMoves.items, 'No common moves found')}</div>
        <p class="source-note">${escapeHtml(commonMoves.label)}</p>
      </section>
      <section class="mini-panel">
        <p class="eyebrow">Common Items / EVs</p>
        <div class="summary-list">
          ${renderPercentRows(commonItems.items, 'No common items found', 3)}
          <hr />
          ${renderPercentRows(commonSpreads.items, 'No EV spreads found')}
        </div>
        <p class="source-note">Items: ${escapeHtml(commonItems.label)} · EVs: ${escapeHtml(commonSpreads.label)}</p>
      </section>
    </div>

    <section>
      <div class="section-head">
        <p class="eyebrow">Auto Matchup Calcs</p>
        <p class="section-note">Top meta checks using ${escapeHtml(usage?.format || 'usage')} data.</p>
      </div>
      <div class="matchup-list">${renderQuickCalcs(quickCalcs)}</div>
    </section>

    <section>
      <div class="section-head">
        <p class="eyebrow">Recommended Doubles Builds</p>
        <p class="section-note">Curated Game8 set notes.</p>
      </div>
      <div class="build-list">${renderBuilds(game8?.builds)}</div>
      ${
        usage?.sourceUrl
          ? `<p class="source-note">Usage data from <a href="${escapeHtml(usage.sourceUrl)}" target="_blank" rel="noreferrer">Pikalytics</a> · ${escapeHtml(usage.format || 'Usage source')}${usage.usageRate ? ` · ${escapeHtml(String(usage.usageRate))}% usage` : ''}</p>`
          : '<p class="source-note">Usage data appears when a Pikalytics page exists for the Pokemon.</p>'
      }
      ${
        game8?.sourceUrl
          ? `<p class="source-note">Build data from <a href="${escapeHtml(game8.sourceUrl)}" target="_blank" rel="noreferrer">Game8</a> · ${escapeHtml(game8.sourceGame || 'Build source')}${game8.updatedAt ? ` · ${escapeHtml(game8.updatedAt)}` : ''}</p>`
          : '<p class="source-note">Game8 build recommendations appear when a doubles page exists.</p>'
      }
    </section>
  `;
}

function buildPayloadFromSelection(source, selectedValue) {
  if (!source) return null;

  if (selectedValue?.startsWith('game8:')) {
    const buildIndex = Number(selectedValue.split(':')[1]);
    const build = source?.game8?.builds?.[buildIndex];
    return {
      name: source.pokemon.name,
      calcName: source.pokemon.calcName,
      level: 50,
      nature: build?.nature || undefined,
      item: build?.heldItem || undefined,
      ability: build?.ability || undefined,
      teraType: build?.teraType || undefined,
      evs: build?.evs || {},
    };
  }

  const spread = source?.usage?.spreads?.[0]?.parsed;
  const fallbackBuild = source?.game8?.builds?.[0];
  return {
    name: source.pokemon.name,
    calcName: source.pokemon.calcName,
    level: 50,
    nature: spread?.nature || fallbackBuild?.nature || 'Serious',
    item: source?.usage?.items?.[0]?.name || fallbackBuild?.heldItem || undefined,
    ability: source?.usage?.abilities?.[0]?.name || fallbackBuild?.ability || undefined,
    evs: spread?.evs || fallbackBuild?.evs || {},
  };
}

function inferRelevantBoosts(moveName, attackerStage, defenderStage) {
  try {
    const move = moveName.toLowerCase();
    const isSpecial = [
      'heat wave', 'overheat', 'solar beam', 'weather ball', 'earth power', 'hurricane',
      'air slash', 'dragon pulse', 'scorching sands', 'flamethrower', 'fire blast',
      'shadow ball', 'moonblast', 'icy wind', 'dazzling gleam', 'thunderbolt', 'psychic',
      'power gem',
    ].includes(move);
    return isSpecial
      ? { attacker: { spa: attackerStage }, defender: { spd: defenderStage } }
      : { attacker: { atk: attackerStage }, defender: { def: defenderStage } };
  } catch {
    return { attacker: { atk: attackerStage }, defender: { def: defenderStage } };
  }
}

function updateAttackerControls() {
  attackerBuildSelect.innerHTML = buildOptionsMarkup(state.attacker || state.currentLookup);
}

function updateDefenderControls() {
  defenderBuildSelect.innerHTML = buildOptionsMarkup(state.defender);
}

function updateMoveOptions() {
  const selectedValue = attackerBuildSelect.value;
  let moves = getUsableUsageMoves(state.attacker?.usage).slice(0, 6).map((entry) => entry.name);

  if (selectedValue?.startsWith('game8:')) {
    const buildIndex = Number(selectedValue.split(':')[1]);
    moves = state.attacker?.game8?.builds?.[buildIndex]?.moves || moves;
  }

  if (!moves.length) {
    moves = state.attacker?.game8?.builds?.[0]?.moves || [];
  }

  const options = ['<option value="">Choose move</option>'];
  moves.forEach((move) => {
    options.push(`<option value="${escapeHtml(move)}">${escapeHtml(move)}</option>`);
  });
  moveSelect.innerHTML = options.join('');
}

function fillRoleFromLookup(role) {
  if (!state.currentLookup) {
    setCalcStatus('Load a Pokemon first so there is something to copy into the calculator.', true);
    return;
  }

  if (role === 'attacker') {
    state.attacker = state.currentLookup;
    attackerNameInput.value = state.currentLookup.pokemon.name;
    updateAttackerControls();
    attackerBuildSelect.value = '';
    updateMoveOptions();
    setCalcStatus('Attacker loaded from the current lookup.');
    return;
  }

  state.defender = state.currentLookup;
  defenderNameInput.value = state.currentLookup.pokemon.name;
  updateDefenderControls();
  defenderBuildSelect.value = '';
  setCalcStatus('Defender loaded from the current lookup.');
}

async function fetchPokemon(query) {
  const response = await fetch(`/api/pokemon?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.details || data.error || 'Request failed');
  }
  return data;
}

lookupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (!query) return;

  setLookupStatus('Loading Pokemon, usage trends, and auto matchup calcs...');

  try {
    const data = await fetchPokemon(query);
    state.currentLookup = data;
    renderPokemonPanel(data);
    setLookupStatus(`Loaded ${data.pokemon.name}.`);
  } catch (error) {
    setLookupStatus(error.message, true);
  }
});

document.querySelectorAll('[data-fill-role]').forEach((button) => {
  button.addEventListener('click', () => fillRoleFromLookup(button.dataset.fillRole));
});

attackerBuildSelect.addEventListener('change', () => {
  updateMoveOptions();
});

loadDefenderButton.addEventListener('click', async () => {
  const query = defenderNameInput.value.trim();
  if (!query) {
    setCalcStatus('Enter a defender name or dex number before loading.', true);
    return;
  }

  setCalcStatus('Loading defender...');
  try {
    const data = await fetchPokemon(query);
    state.defender = data;
    defenderNameInput.value = data.pokemon.name;
    updateDefenderControls();
    defenderBuildSelect.value = '';
    setCalcStatus(`Defender loaded: ${data.pokemon.name}.`);
  } catch (error) {
    setCalcStatus(error.message, true);
  }
});

runCalcButton.addEventListener('click', async () => {
  if (!state.attacker) {
    setCalcStatus('Load or copy an attacker into the calculator first.', true);
    return;
  }
  if (!state.defender) {
    setCalcStatus('Load a defender into the calculator first.', true);
    return;
  }
  if (!moveSelect.value) {
    setCalcStatus('Choose an attacker move before calculating.', true);
    return;
  }

  const payload = {
    attacker: buildPayloadFromSelection(state.attacker, attackerBuildSelect.value),
    defender: buildPayloadFromSelection(state.defender, defenderBuildSelect.value),
    move: moveSelect.value,
    options: {
      weather: weatherSelect.value || undefined,
      terrain: terrainSelect.value || undefined,
      isHelpingHand: helpingHandInput.checked,
      isReflect: reflectInput.checked,
      isLightScreen: lightScreenInput.checked,
      isCrit: critInput.checked,
    },
  };

  const boosts = inferRelevantBoosts(
    moveSelect.value,
    Number(attackerStageSelect.value || 0),
    Number(defenderStageSelect.value || 0)
  );
  payload.attacker.boosts = boosts.attacker;
  payload.defender.boosts = boosts.defender;
  if (burnedInput.checked) payload.attacker.status = 'brn';

  setCalcStatus('Calculating...');

  try {
    const response = await fetch('/api/calc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.details || data.error || 'Calculation failed');
    }

    calcResult.classList.remove('empty');
    calcResult.innerHTML = `
      <div class="calc-range">${escapeHtml(String(data.min))}-${escapeHtml(String(data.max))} HP</div>
      <div class="calc-desc">${escapeHtml(data.summary)}</div>
    `;
    setCalcStatus('Damage range ready.');
  } catch (error) {
    calcResult.classList.add('empty');
    calcResult.innerHTML = '<p>Damage output will land here.</p>';
    setCalcStatus(error.message, true);
  }
});
