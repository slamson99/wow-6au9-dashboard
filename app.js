/**
 * app.js
 * ----------------------------------------------------------------------------
 * Client-side application logic for the WoW Forever Roster Dashboard.
 * - Hardcoded to Realm: Maladath (Oceanic) | Region: US
 * - Loads static snapshot data strictly from ./data/stats.json (no mock fallbacks)
 * - Purges legacy localStorage keys and stores user-added Maladath characters
 * - Supports searching, class/spec/status filtering, and responsive modals
 * - Exports clean `[{ "name": "...", "realm": "maladath", "region": "us" }]` JSON
 */

const LOCAL_STORAGE_KEY = 'wow_forever_pvp_roster_v1';
const LEGACY_STORAGE_KEYS = [
  'wow_forever_local_characters_v1',
  'wow_forever_local_characters_v2',
  'wow_maladath_roster_v1'
];

const HARDCODED_REALM_SLUG = 'pvp';
const HARDCODED_REALM_NAME = 'PvP';
const HARDCODED_REGION = 'us';
const DEFAULT_ONLINE_THRESHOLD_MINUTES = 30;

/** Official Blizzard Class Color Palette */
const WOW_CLASS_COLORS = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  'Druid': '#FF7C0A',
  'Evoker': '#33937F',
  'Hunter': '#AAD372',
  'Mage': '#3FC7EB',
  'Monk': '#00FF98',
  'Paladin': '#F48CBA',
  'Priest': '#FFFFFF',
  'Rogue': '#FFF468',
  'Shaman': '#0070DD',
  'Warlock': '#8788EE',
  'Warrior': '#C69B6D'
};

/** Class Default Avatar Icons */
const WOW_CLASS_ICONS = {
  'Death Knight': 'https://render.worldofwarcraft.com/us/icons/56/classicon_deathknight.jpg',
  'Demon Hunter': 'https://render.worldofwarcraft.com/us/icons/56/classicon_demonhunter.jpg',
  'Druid': 'https://render.worldofwarcraft.com/us/icons/56/classicon_druid.jpg',
  'Evoker': 'https://render.worldofwarcraft.com/us/icons/56/classicon_evoker.jpg',
  'Hunter': 'https://render.worldofwarcraft.com/us/icons/56/classicon_hunter.jpg',
  'Mage': 'https://render.worldofwarcraft.com/us/icons/56/classicon_mage.jpg',
  'Monk': 'https://render.worldofwarcraft.com/us/icons/56/classicon_monk.jpg',
  'Paladin': 'https://render.worldofwarcraft.com/us/icons/56/classicon_paladin.jpg',
  'Priest': 'https://render.worldofwarcraft.com/us/icons/56/classicon_priest.jpg',
  'Rogue': 'https://render.worldofwarcraft.com/us/icons/56/classicon_rogue.jpg',
  'Shaman': 'https://render.worldofwarcraft.com/us/icons/56/classicon_shaman.jpg',
  'Warlock': 'https://render.worldofwarcraft.com/us/icons/56/classicon_warlock.jpg',
  'Warrior': 'https://render.worldofwarcraft.com/us/icons/56/classicon_warrior.jpg'
};

/** 16 Armory Slots for Paper-Doll Display */
const ARMORY_SLOTS = [
  { slot: 'HEAD', slot_name: 'Head', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_helmet_03.jpg' },
  { slot: 'NECK', slot_name: 'Neck', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_necklace_07.jpg' },
  { slot: 'SHOULDER', slot_name: 'Shoulders', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_shoulder_02.jpg' },
  { slot: 'BACK', slot_name: 'Back', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_cape_18.jpg' },
  { slot: 'CHEST', slot_name: 'Chest', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_chest_chain_03.jpg' },
  { slot: 'WRIST', slot_name: 'Wrist', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_bracer_07.jpg' },
  { slot: 'HANDS', slot_name: 'Hands', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_gauntlets_04.jpg' },
  { slot: 'WAIST', slot_name: 'Waist', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_belt_03.jpg' },
  { slot: 'LEGS', slot_name: 'Legs', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_pants_03.jpg' },
  { slot: 'FEET', slot_name: 'Feet', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_boots_05.jpg' },
  { slot: 'FINGER_1', slot_name: 'Ring 1', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_ring_03.jpg' },
  { slot: 'FINGER_2', slot_name: 'Ring 2', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_ring_05.jpg' },
  { slot: 'TRINKET_1', slot_name: 'Trinket 1', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_talisman_07.jpg' },
  { slot: 'TRINKET_2', slot_name: 'Trinket 2', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_orb_05.jpg' },
  { slot: 'MAIN_HAND', slot_name: 'Main Hand', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_sword_04.jpg' },
  { slot: 'OFF_HAND', slot_name: 'Off Hand', icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_shield_06.jpg' }
];

/** Application State */
const state = {
  staticCharacters: [],
  localEntries: [], // Array of { name: "lowercase", realm: "maladath", region: "us" }
  mergedCharacters: [],
  onlineThresholdMinutes: DEFAULT_ONLINE_THRESHOLD_MINUTES,
  snapshotUpdatedAt: null,
  activeCharacterId: null,
  filters: {
    search: '',
    className: 'ALL',
    specName: 'ALL',
    status: 'ALL'
  }
};

/* ========================================================================== */
/* UTILITY & FORMATTING FUNCTIONS                                             */
/* ========================================================================== */

function getClassColor(className) {
  return WOW_CLASS_COLORS[className] || '#c69b3a';
}

function getClassIcon(className) {
  return WOW_CLASS_ICONS[className] || 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg';
}

function formatNumber(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '0';
  return Number(num).toLocaleString();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Determine if a character is online based on `last_login_timestamp` and threshold,
 * or explicit `is_online` flag when timestamp is within threshold.
 */
function isCharacterOnline(character) {
  if (!character) return false;
  const ts = Number(character.last_login_timestamp || 0);
  const thresholdMs = (state.onlineThresholdMinutes || DEFAULT_ONLINE_THRESHOLD_MINUTES) * 60 * 1000;
  if (ts > 0) {
    const diff = Date.now() - ts;
    if (diff >= 0 && diff <= thresholdMs) {
      return true;
    }
  }
  return Boolean(character.is_online);
}

/**
 * Format a timestamp into a readable relative time string (e.g., "Seen 12m ago").
 */
function formatRelativeTime(timestamp, isOnlineFlag) {
  if (isOnlineFlag) {
    return 'Online Now';
  }
  if (!timestamp || Number(timestamp) <= 0) {
    return 'Pending Sync';
  }

  const diffSeconds = Math.max(60, Math.floor((Date.now() - Number(timestamp)) / 1000));
  if (diffSeconds < 3600) {
    const mins = Math.max(1, Math.floor(diffSeconds / 60));
    return `Seen ${mins}m ago`;
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `Seen ${hours}h ago`;
  }
  const days = Math.floor(diffSeconds / 86400);
  if (days < 30) {
    return `Seen ${days}d ago`;
  }
  const dateObj = new Date(Number(timestamp));
  return `Seen ${dateObj.toLocaleDateString()}`;
}

/* ========================================================================== */
/* LOCAL STORAGE & MALADATH ROSTER MANAGEMENT                                 */
/* ========================================================================== */

/**
 * Purge any legacy localStorage keys so old dummy or non-Maladath characters never reappear.
 */
function purgeLegacyLocalStorage() {
  try {
    for (const oldKey of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(oldKey);
    }
  } catch (err) {
    console.warn('Unable to clear legacy localStorage keys:', err);
  }
}

function loadLocalEntries() {
  purgeLegacyLocalStorage();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(item => {
        const cleanName = String(item.name || '').trim().toLowerCase();
        if (!cleanName) return null;
        return {
          name: cleanName,
          realm: HARDCODED_REALM_SLUG,
          region: HARDCODED_REGION
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('Failed to parse local characters from localStorage:', err);
    return [];
  }
}

function saveLocalEntries(entries) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to save local characters to localStorage:', err);
  }
}

/**
 * Format a hyphenated or single character name nicely for display (e.g. "slamson-slamson" -> "Slamson-Slamson").
 */
function formatCharacterDisplayName(name) {
  return String(name || '')
    .trim()
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
}

/**
 * Combine first and optional second name into a sanitized slug:
 * - Auto-allocates a hyphen in between when secondName is present
 * - No hyphen if secondName is empty
 */
function combineFirstAndSecondName(firstName, secondName) {
  const first = String(firstName || '').trim().toLowerCase().replace(/^-+|-+$/g, '');
  const second = String(secondName || '').trim().toLowerCase().replace(/^-+|-+$/g, '');
  if (!first) return '';
  return second ? `${first}-${second}` : first;
}

/**
 * Build a clean queued character representation for locally added Maladath players
 * before their snapshot is populated by `fetch-stats.js` in GitHub Actions.
 */
function buildQueuedMaladathProfile(entry) {
  const cleanName = String(entry.name || '').trim().toLowerCase();
  const formattedName = formatCharacterDisplayName(cleanName);
  const id = `${HARDCODED_REGION}-${HARDCODED_REALM_SLUG}-${cleanName}`;

  const equipment = ARMORY_SLOTS.map(slotDef => ({
    slot: slotDef.slot,
    slot_name: slotDef.slot_name,
    name: `${slotDef.slot_name} (Pending API Sync)`,
    item_level: 0,
    quality: 'COMMON',
    icon: slotDef.icon,
    enchant: 'Queued for Battle.net Sync'
  }));

  return {
    id,
    is_local: true,
    name: formattedName,
    title: '',
    formatted_title: formattedName,
    realm: {
      name: HARDCODED_REALM_NAME,
      slug: HARDCODED_REALM_SLUG
    },
    region: HARDCODED_REGION,
    faction: 'Azeroth',
    race: 'Pending API Sync',
    class: 'Warrior',
    active_spec: 'Armory Queued',
    level: '—',
    equipped_item_level: '—',
    average_item_level: '—',
    achievement_points: 0,
    last_login_timestamp: 0,
    is_online: false,
    location: 'Maladath (Oceanic)',
    guild: null,
    media: {
      avatar: 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg',
      inset: 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg',
      main_raw: 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg'
    },
    stats: {
      health: 0,
      resource_type: 'Resource',
      resource_amount: 0,
      strength: 0,
      agility: 0,
      intellect: 0,
      stamina: 0,
      armor: 0,
      crit: 0,
      haste: 0,
      mastery: 0,
      versatility: 0,
      primary_stat_name: 'Primary',
      primary_stat_value: 0
    },
    equipment,
    activity: {
      quests_completed_total: 0,
      hours_active_estimate: 0,
      recent_quests: [
        {
          title: 'Queued for Battle.net Snapshot Sync (fetch-stats.js)',
          zone: 'Maladath (Oceanic)',
          status: 'Queued'
        }
      ]
    }
  };
}

/**
 * Normalize a character object from `data/stats.json` (supports both the flat Classic/Forever
 * schema produced by `fetch-stats.js` and the detailed schema).
 */
function normalizeStaticCharacter(raw) {
  if (!raw || !raw.name) return null;

  const charId = (raw.id || `${HARDCODED_REGION}-${HARDCODED_REALM_SLUG}-${raw.name}`).toLowerCase();
  const displayName = formatCharacterDisplayName(raw.name);
  const realmObj = typeof raw.realm === 'object' && raw.realm !== null
    ? raw.realm
    : {
        name: formatCharacterDisplayName(String(raw.realm || HARDCODED_REALM_NAME)),
        slug: HARDCODED_REALM_SLUG
      };

  const lastLoginMs = raw.last_login_timestamp
    ? Number(raw.last_login_timestamp)
    : raw.lastLogin
      ? new Date(raw.lastLogin).getTime()
      : 0;

  const rawStats = raw.stats || {};
  const strength = Number(rawStats.strength || 0);
  const agility = Number(rawStats.agility || 0);
  const intellect = Number(rawStats.intellect || 0);
  const stamina = Number(rawStats.stamina || 0);

  let primaryName = rawStats.primary_stat_name || 'Primary';
  let primaryVal = Number(rawStats.primary_stat_value || 0);
  if (!primaryVal && (strength || agility || intellect)) {
    const candidates = [
      { name: 'Strength', value: strength },
      { name: 'Agility', value: agility },
      { name: 'Intellect', value: intellect }
    ].sort((a, b) => b.value - a.value);
    primaryName = candidates[0].name;
    primaryVal = candidates[0].value;
  }

  const className = raw.class || 'Warrior';
  const avatarUrl = raw.media?.avatar || raw.avatarUrl || getClassIcon(className);

  return {
    ...raw,
    id: charId,
    name: displayName,
    formatted_title: raw.formatted_title || displayName,
    realm: realmObj,
    region: raw.region || HARDCODED_REGION,
    race: raw.race || (raw.pending ? 'Pending API Sync' : 'Champion'),
    class: className,
    active_spec: raw.active_spec || raw.spec || 'Classic',
    level: raw.level ?? '—',
    equipped_item_level: raw.equipped_item_level ?? raw.equippedItemLevel ?? '—',
    average_item_level: raw.average_item_level ?? raw.averageItemLevel ?? '—',
    last_login_timestamp: Number.isNaN(lastLoginMs) ? 0 : lastLoginMs,
    is_online: Boolean(raw.is_online ?? raw.online),
    location: raw.location || `${realmObj.name} (Oceanic)`,
    media: {
      avatar: avatarUrl,
      inset: raw.media?.inset || avatarUrl,
      main_raw: raw.media?.main_raw || avatarUrl
    },
    stats: {
      ...rawStats,
      strength,
      agility,
      intellect,
      stamina,
      crit: Number(rawStats.crit || 0),
      haste: Number(rawStats.haste || 0),
      mastery: Number(rawStats.mastery || 0),
      versatility: Number(rawStats.versatility || 0),
      primary_stat_name: primaryName,
      primary_stat_value: primaryVal
    },
    is_local: false
  };
}

/**
 * Merge static characters loaded from `./data/stats.json` with locally added Maladath entries.
 * Never injects mock fallback characters.
 */
function mergeCharacterRoster() {
  const byId = new Map();

  for (const staticChar of state.staticCharacters) {
    const normalized = normalizeStaticCharacter(staticChar);
    if (normalized) {
      byId.set(normalized.id, normalized);
    }
  }

  for (const entry of state.localEntries) {
    const id = `${HARDCODED_REGION}-${HARDCODED_REALM_SLUG}-${entry.name.toLowerCase()}`;
    if (!byId.has(id)) {
      byId.set(id, buildQueuedMaladathProfile(entry));
    }
  }

  state.mergedCharacters = Array.from(byId.values());
}

/* ========================================================================== */
/* FILTERING & DROPDOWN POPULATION                                            */
/* ========================================================================== */

function populateDynamicFilterOptions() {
  const classSelect = document.getElementById('classFilter');
  const specSelect = document.getElementById('specFilter');

  const classes = Array.from(new Set(state.mergedCharacters.map(c => c.class).filter(Boolean))).sort();
  const specs = Array.from(new Set(state.mergedCharacters.map(c => c.active_spec).filter(Boolean))).sort();

  const currentClass = state.filters.className;
  const currentSpec = state.filters.specName;

  classSelect.innerHTML = '<option value="ALL">All Classes</option>' +
    classes.map(cls => `<option value="${escapeHtml(cls)}">${escapeHtml(cls)}</option>`).join('');

  specSelect.innerHTML = '<option value="ALL">All Specs</option>' +
    specs.map(sp => `<option value="${escapeHtml(sp)}">${escapeHtml(sp)}</option>`).join('');

  if (classes.includes(currentClass)) classSelect.value = currentClass;
  if (specs.includes(currentSpec)) specSelect.value = currentSpec;
}

function getFilteredCharacters() {
  const q = state.filters.search.trim().toLowerCase();

  return state.mergedCharacters.filter(char => {
    const online = isCharacterOnline(char);

    if (state.filters.className !== 'ALL' && char.class !== state.filters.className) {
      return false;
    }

    if (state.filters.specName !== 'ALL' && char.active_spec !== state.filters.specName) {
      return false;
    }

    if (state.filters.status === 'ONLINE' && !online) return false;
    if (state.filters.status === 'OFFLINE' && online) return false;
    if (state.filters.status === 'LOCAL' && !char.is_local) return false;

    if (q) {
      const haystack = [
        char.name,
        char.formatted_title,
        char.race,
        char.class,
        char.active_spec,
        char.realm?.name,
        char.realm?.slug,
        char.region,
        char.location,
        char.guild?.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

/* ========================================================================== */
/* UI RENDERING: HEADER & CHARACTER CARDS                                     */
/* ========================================================================== */

function updateHeaderStatusUI() {
  const statusEl = document.getElementById('snapshotStatusText');
  const countEl = document.getElementById('rosterSummaryCount');

  const onlineCount = state.mergedCharacters.filter(c => isCharacterOnline(c)).length;
  const totalCount = state.mergedCharacters.length;
  const localCount = state.mergedCharacters.filter(c => c.is_local).length;

  countEl.textContent = `${totalCount} Champion${totalCount === 1 ? '' : 's'} on Maladath (${onlineCount} Online${localCount > 0 ? ` • ${localCount} Local` : ''})`;

  if (state.snapshotUpdatedAt) {
    const updatedDate = new Date(state.snapshotUpdatedAt);
    const formattedTime = Number.isNaN(updatedDate.getTime())
      ? state.snapshotUpdatedAt
      : updatedDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    statusEl.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
      <span>Snapshot: <strong class="text-slate-200">${escapeHtml(formattedTime)}</strong></span>
    `;
  } else {
    statusEl.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-amber-400"></span>
      <span>Maladath Roster Mode</span>
    `;
  }
}

function renderCharacterCards() {
  const grid = document.getElementById('characterGrid');
  const emptyState = document.getElementById('emptyStateContainer');
  const filtered = getFilteredCharacters();

  updateHeaderStatusUI();

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  grid.innerHTML = filtered.map(char => {
    const classColor = getClassColor(char.class);
    const online = isCharacterOnline(char);
    const relativeSeen = formatRelativeTime(char.last_login_timestamp, online);
    const primaryStatLabel = char.stats?.primary_stat_name || 'Primary';
    const primaryStatVal = char.stats?.primary_stat_value ? formatNumber(char.stats.primary_stat_value) : '—';
    const staminaVal = char.stats?.stamina ? formatNumber(char.stats.stamina) : '—';
    const ilvl = char.equipped_item_level ?? '—';
    const avatarUrl = char.media?.avatar || getClassIcon(char.class);

    const statusBadgeHtml = online
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
           Online
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/90 text-slate-400 border border-slate-700">
           <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
           ${escapeHtml(relativeSeen)}
         </span>`;

    const localBadgeHtml = char.is_local
      ? `<span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-semibold">Local</span>`
      : '';

    return `
      <article
        data-char-id="${escapeHtml(char.id)}"
        tabindex="0"
        role="button"
        aria-label="Inspect ${escapeHtml(char.name)}, Level ${char.level} ${escapeHtml(char.active_spec)} ${escapeHtml(char.class)}"
        class="character-card wow-frame wow-frame-interactive rounded-xl overflow-hidden cursor-pointer flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-wowgold-400"
      >
        <!-- Top Class Color Bar -->
        <div class="h-1.5 w-full" style="background-color: ${classColor};"></div>

        <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
          <!-- Card Header: Avatar + Name/Title + Online Status -->
          <div>
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="relative shrink-0">
                  <img
                    src="${escapeHtml(avatarUrl)}"
                    alt="${escapeHtml(char.name)}"
                    onerror="this.onerror=null;this.src='${getClassIcon(char.class)}';"
                    class="w-14 h-14 rounded-lg object-cover border-2 bg-obsidian-950 shadow-md"
                    style="border-color: ${classColor};"
                  />
                  <span class="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.2 rounded bg-obsidian-950 border border-wowgold-400 text-[10px] font-bold text-wowgold-300">
                    ${escapeHtml(char.level)}
                  </span>
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <h2 class="font-display text-lg font-bold tracking-wide truncate" style="color: ${classColor};">
                      ${escapeHtml(char.name)}
                    </h2>
                    ${localBadgeHtml}
                  </div>
                  <p class="text-xs text-slate-400 truncate italic">
                    ${escapeHtml(char.formatted_title || char.name)}
                  </p>
                  <p class="text-xs text-slate-200 font-medium mt-0.5 truncate">
                    ${escapeHtml(char.race)} • <span style="color: ${classColor};">${escapeHtml(char.active_spec)} ${escapeHtml(char.class)}</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Status & Realm Row -->
            <div class="flex items-center justify-between gap-2 mt-3.5 pt-2.5 border-t border-slate-800/80 text-xs">
              <div class="flex items-center gap-1.5 text-slate-300 truncate">
                <span class="uppercase font-bold text-[10px] px-1.5 py-0.5 rounded bg-obsidian-950 border border-slate-700 text-wowgold-300">
                  ${escapeHtml((char.region || HARDCODED_REGION).toUpperCase())}
                </span>
                <span class="truncate font-medium">${escapeHtml(char.realm?.name || HARDCODED_REALM_NAME)}</span>
              </div>
              <div class="shrink-0">
                ${statusBadgeHtml}
              </div>
            </div>
          </div>

          <!-- Primary Zone / Location Box -->
          <div class="bg-obsidian-950/75 border border-slate-800/90 rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
            <svg class="w-4 h-4 text-wowgold-400 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="text-slate-300 truncate" title="${escapeHtml(char.location || 'Maladath (Oceanic)')}">
              ${escapeHtml(char.location || 'Maladath (Oceanic)')}
            </span>
          </div>

          <!-- Core Stats Preview (Item Level, Stamina, Primary Stat) -->
          <div class="grid grid-cols-3 gap-2 pt-1">
            <div class="bg-obsidian-950/90 border border-wowgold-500/30 rounded-md p-2 text-center">
              <span class="block text-[10px] uppercase tracking-wider text-slate-400">Item Lvl</span>
              <span class="font-display text-sm font-bold text-wowgold-300">${escapeHtml(ilvl)}</span>
            </div>
            <div class="bg-obsidian-950/90 border border-slate-800 rounded-md p-2 text-center">
              <span class="block text-[10px] uppercase tracking-wider text-slate-400">Stamina</span>
              <span class="text-xs font-bold text-slate-200">${escapeHtml(staminaVal)}</span>
            </div>
            <div class="bg-obsidian-950/90 border border-slate-800 rounded-md p-2 text-center">
              <span class="block text-[10px] uppercase tracking-wider text-slate-400">${escapeHtml(primaryStatLabel)}</span>
              <span class="text-xs font-bold text-slate-200">${escapeHtml(primaryStatVal)}</span>
            </div>
          </div>
        </div>

        <!-- Card Footer Prompt -->
        <div class="px-4 py-2 bg-obsidian-950/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span class="truncate">${escapeHtml(char.guild?.name ? `<${char.guild.name}>` : 'Maladath Roster')}</span>
          <span class="text-wowgold-400 font-semibold flex items-center gap-1 shrink-0">
            Inspect Armory
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </article>
    `;
  }).join('');

  // Attach click and keyboard listeners to each rendered card
  document.querySelectorAll('.character-card').forEach(cardEl => {
    const charId = cardEl.getAttribute('data-char-id');
    cardEl.addEventListener('click', () => openCharacterDetailModal(charId));
    cardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCharacterDetailModal(charId);
      }
    });
  });
}

/* ========================================================================== */
/* MODAL 1: EXPANDED CHARACTER DETAIL VIEW                                    */
/* ========================================================================== */

function openCharacterDetailModal(charId) {
  const char = state.mergedCharacters.find(c => c.id === charId);
  if (!char) return;

  state.activeCharacterId = char.id;
  const classColor = getClassColor(char.class);
  const online = isCharacterOnline(char);
  const relativeSeen = formatRelativeTime(char.last_login_timestamp, online);

  // Header & Identity
  document.getElementById('detailModalClassBar').style.backgroundColor = classColor;
  const avatarEl = document.getElementById('detailModalAvatar');
  avatarEl.src = char.media?.avatar || getClassIcon(char.class);
  avatarEl.onerror = () => { avatarEl.src = getClassIcon(char.class); };
  avatarEl.style.borderColor = classColor;

  document.getElementById('detailModalLevelBadge').textContent = `Lv ${char.level || '—'}`;

  const nameEl = document.getElementById('detailModalName');
  nameEl.textContent = char.name;
  nameEl.style.color = classColor;

  const onlineBadge = document.getElementById('detailModalOnlineBadge');
  if (online) {
    onlineBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    onlineBadge.textContent = '● Online Now';
  } else {
    onlineBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700';
    onlineBadge.textContent = relativeSeen;
  }

  const localBadge = document.getElementById('detailModalLocalBadge');
  const deleteLocalBtn = document.getElementById('deleteLocalCharBtn');
  if (char.is_local) {
    localBadge.classList.remove('hidden');
    deleteLocalBtn.classList.remove('hidden');
  } else {
    localBadge.classList.add('hidden');
    deleteLocalBtn.classList.add('hidden');
  }

  document.getElementById('detailModalTitle').textContent = char.formatted_title || char.name;
  document.getElementById('detailModalIdentityLine').innerHTML =
    `Level ${escapeHtml(char.level)} ${escapeHtml(char.race)} <span style="color:${classColor};">${escapeHtml(char.active_spec)} ${escapeHtml(char.class)}</span>`;

  document.getElementById('detailModalGuildLine').textContent = char.guild?.name
    ? `<${char.guild.name}> (${char.guild.rank || 'Member'})`
    : 'Maladath Champion';

  document.getElementById('detailModalRealmLine').textContent =
    `${char.realm?.name || HARDCODED_REALM_NAME} (${(char.region || HARDCODED_REGION).toUpperCase()})`;

  // Summary Ribbon
  document.getElementById('detailModalIlvl').textContent = char.equipped_item_level ?? '—';
  document.getElementById('detailModalAvgIlvl').textContent = `(${char.average_item_level || char.equipped_item_level || '—'} Avg)`;
  document.getElementById('detailModalLocation').textContent = char.location || 'Maladath (Oceanic)';

  const lastSeenEl = document.getElementById('detailModalLastSeen');
  lastSeenEl.textContent = online ? 'Active in World' : relativeSeen;
  lastSeenEl.className = online
    ? 'text-sm sm:text-base font-semibold text-emerald-400 block mt-0.5'
    : 'text-sm sm:text-base font-semibold text-slate-200 block mt-0.5';

  const hoursEst = char.activity?.hours_active_estimate || 0;
  const achvPts = formatNumber(char.achievement_points || 0);
  document.getElementById('detailModalHoursPlayed').textContent =
    `Est. ${formatNumber(hoursEst)} hrs played • ${achvPts} Achv Pts`;

  // Combat Attributes
  const st = char.stats || {};
  document.getElementById('detailModalHealthPool').textContent =
    st.health ? `${formatNumber(st.health)} HP` : '';

  document.getElementById('statStrength').textContent = formatNumber(st.strength || 0);
  document.getElementById('statAgility').textContent = formatNumber(st.agility || 0);
  document.getElementById('statIntellect').textContent = formatNumber(st.intellect || 0);
  document.getElementById('statStamina').textContent = formatNumber(st.stamina || 0);

  document.getElementById('statCrit').textContent = `${Number(st.crit || 0).toFixed(1)}%`;
  document.getElementById('statHaste').textContent = `${Number(st.haste || 0).toFixed(1)}%`;
  document.getElementById('statMastery').textContent = `${Number(st.mastery || 0).toFixed(1)}%`;
  document.getElementById('statVersatility').textContent = `${Number(st.versatility || 0).toFixed(1)}%`;
  document.getElementById('statArmor').textContent = formatNumber(st.armor || 0);

  // Quest Log & Activity
  const totalQuests = char.activity?.quests_completed_total || 0;
  document.getElementById('detailModalQuestCount').textContent = `${formatNumber(totalQuests)} Completed`;

  const quests = Array.isArray(char.activity?.recent_quests) && char.activity.recent_quests.length > 0
    ? char.activity.recent_quests
    : [{ title: 'Adventuring on Maladath', zone: char.location || 'Maladath (Oceanic)', status: 'Active' }];

  document.getElementById('detailModalQuestList').innerHTML = quests.map(q => {
    const isCurrent = String(q.status || '').toLowerCase().includes('active');
    const badgeCls = isCurrent
      ? 'bg-wowgold-500/20 text-wowgold-300 border-wowgold-500/40'
      : 'bg-slate-800 text-slate-400 border-slate-700';

    return `
      <li class="p-2.5 rounded bg-obsidian-900/90 border border-slate-800/90 flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs font-semibold text-slate-100 truncate">${escapeHtml(q.title)}</p>
          <p class="text-[11px] text-slate-400 truncate mt-0.5">${escapeHtml(q.zone || 'Maladath')}</p>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded border shrink-0 font-medium ${badgeCls}">
          ${escapeHtml(q.status || 'Completed')}
        </span>
      </li>
    `;
  }).join('');

  // 16-Slot Equipment Grid
  const equipList = Array.isArray(char.equipment) && char.equipment.length > 0
    ? char.equipment
    : ARMORY_SLOTS.map(s => ({
        slot: s.slot,
        slot_name: s.slot_name,
        name: `${s.slot_name} (Pending API Sync)`,
        item_level: 0,
        quality: 'POOR',
        icon: s.icon,
        enchant: null
      }));

  document.getElementById('detailModalEquipmentGrid').innerHTML = equipList.map(item => {
    const quality = (item.quality || 'COMMON').toUpperCase();
    const borderCls = `quality-border-${quality}`;
    const textCls = `quality-text-${quality}`;
    const enchantLine = item.enchant
      ? `<span class="text-[10px] text-emerald-400 block truncate">✦ ${escapeHtml(item.enchant)}</span>`
      : `<span class="text-[10px] text-slate-500 block truncate">${escapeHtml(item.slot_name)}</span>`;

    return `
      <div class="p-2 rounded-lg bg-obsidian-900/90 border border-slate-800/90 hover:border-slate-700 flex items-center gap-3 transition-colors">
        <div class="relative shrink-0">
          <img
            src="${escapeHtml(item.icon || 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg')}"
            alt="${escapeHtml(item.name)}"
            onerror="this.onerror=null;this.src='https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg';"
            class="w-11 h-11 rounded-md object-cover border-2 bg-obsidian-950 ${borderCls}"
          />
          ${item.item_level > 0 ? `
            <span class="absolute -bottom-1 -right-1 px-1 rounded bg-obsidian-950 border border-slate-700 text-[10px] font-bold text-slate-200">
              ${escapeHtml(item.item_level)}
            </span>
          ` : ''}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold truncate ${textCls}" title="${escapeHtml(item.name)}">
            ${escapeHtml(item.name)}
          </p>
          ${enchantLine}
        </div>
      </div>
    `;
  }).join('');

  const modal = document.getElementById('characterDetailModal');
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeCharacterDetailModal() {
  const modal = document.getElementById('characterDetailModal');
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  state.activeCharacterId = null;
}

/* ========================================================================== */
/* MODAL 2 & 3: ADD PLAYER & EXPORT CHARACTERS.JSON                           */
/* ========================================================================== */

function updateCharacterNamePreview() {
  const firstEl = document.getElementById('charFirstNameInput');
  const secondEl = document.getElementById('charSecondNameInput');
  const previewEl = document.getElementById('charNamePreview');
  if (!previewEl) return;

  const combined = combineFirstAndSecondName(firstEl?.value, secondEl?.value);
  previewEl.textContent = combined || '—';
}

function openAddPlayerModal() {
  const modal = document.getElementById('addPlayerModal');
  const statusMsg = document.getElementById('addPlayerStatusMsg');
  if (statusMsg) statusMsg.classList.add('hidden');
  updateCharacterNamePreview();
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => document.getElementById('charFirstNameInput')?.focus(), 50);
}

function closeAddPlayerModal() {
  const modal = document.getElementById('addPlayerModal');
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

/**
 * Formats the combined WoW Forever PvP roster cleanly as:
 * [
 *   { "name": "slamson", "realm": "pvp", "region": "us" }
 * ]
 */
function buildCharactersJsonExportPayload() {
  return state.mergedCharacters.map(c => ({
    name: String(c.name || '').trim().toLowerCase().split(/[-\s]+/)[0],
    realm: HARDCODED_REALM_SLUG,
    region: HARDCODED_REGION
  }));
}

function openExportJsonModal() {
  const exportPayload = buildCharactersJsonExportPayload();
  const textarea = document.getElementById('exportJsonTextarea');
  textarea.value = JSON.stringify(exportPayload, null, 2);

  const modal = document.getElementById('exportJsonModal');
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeExportJsonModal() {
  const modal = document.getElementById('exportJsonModal');
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

/* ========================================================================== */
/* MODAL 4: GITHUB PAT SETTINGS & DIRECT WORKFLOW_DISPATCH TRIGGER            */
/* ========================================================================== */

const GITHUB_WORKFLOW_DISPATCH_URL =
  'https://api.github.com/repos/slamson99/wow-6au9-dashboard/actions/workflows/update.yml/dispatches';

function openSettingsModal() {
  const modal = document.getElementById('patSettingsModal');
  const input = document.getElementById('ghPatInput');
  if (input) {
    input.value = localStorage.getItem('gh_pat') || '';
  }
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => input?.focus(), 50);
}

function closeSettingsModal() {
  const modal = document.getElementById('patSettingsModal');
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function setButtonLoading(isLoading, labelText) {
  const btn = document.getElementById('forceSyncApiBtn');
  const label = document.getElementById('forceSyncBtnLabel');
  const icon = document.getElementById('forceSyncIcon');

  if (btn) btn.disabled = isLoading;
  if (label && labelText) label.textContent = labelText;
  if (icon) {
    if (isLoading) {
      icon.classList.add('animate-spin');
    } else {
      icon.classList.remove('animate-spin');
    }
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  const isError = type === 'error';

  const borderCls = isSuccess
    ? 'border-emerald-500/60 bg-obsidian-950/95 text-emerald-200'
    : isError
      ? 'border-red-500/60 bg-obsidian-950/95 text-red-200'
      : 'border-wowgold-400/60 bg-obsidian-950/95 text-slate-200';

  const badgeIcon = isSuccess
    ? `<svg class="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
       </svg>`
    : isError
      ? `<svg class="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
         </svg>`
      : `<svg class="w-5 h-5 text-wowgold-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
         </svg>`;

  toast.className = `pointer-events-auto wow-frame rounded-lg p-3.5 border shadow-wow-modal flex items-start justify-between gap-3 transition-all duration-300 ${borderCls}`;
  toast.innerHTML = `
    <div class="flex items-start gap-2.5 text-xs leading-relaxed">
      ${badgeIcon}
      <span>${escapeHtml(message)}</span>
    </div>
    <button type="button" class="text-slate-400 hover:text-white shrink-0" aria-label="Dismiss notification">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `;

  toast.querySelector('button')?.addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 6500);
}

async function triggerWorkflowSync() {
  const pat = localStorage.getItem('gh_pat');
  if (!pat) {
    openSettingsModal();
    return;
  }

  setButtonLoading(true, 'Triggering Action...');

  try {
    const response = await fetch(
      GITHUB_WORKFLOW_DISPATCH_URL,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main'
        })
      }
    );

    if (response.status === 204) {
      showToast('Sync triggered! GitHub Action is updating character stats. Live data will refresh in ~1-2 minutes.', 'success');
    } else {
      const err = await response.json().catch(() => ({}));
      showToast(`Error triggering sync: ${err.message || 'Check PAT permissions'}`, 'error');
    }
  } catch (error) {
    showToast(`Network error: ${error.message}`, 'error');
  } finally {
    setButtonLoading(false, 'Force Sync API');
  }
}

/* ========================================================================== */
/* DATA FETCHING FROM ./data/stats.json                                       */
/* ========================================================================== */

async function fetchStaticSnapshot() {
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) refreshIcon.classList.add('animate-spin');

  try {
    const response = await fetch(`./data/stats.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading data/stats.json`);
    }
    const payload = await response.json();
    state.staticCharacters = Array.isArray(payload.characters) ? payload.characters : [];
    state.onlineThresholdMinutes = Number(payload.online_threshold_minutes || DEFAULT_ONLINE_THRESHOLD_MINUTES);
    state.snapshotUpdatedAt = payload.updated_at || payload.updated || null;
  } catch (err) {
    console.warn('Could not load ./data/stats.json snapshot:', err.message);
    state.staticCharacters = [];
  } finally {
    if (refreshIcon) {
      setTimeout(() => refreshIcon.classList.remove('animate-spin'), 350);
    }
  }

  state.localEntries = loadLocalEntries();
  mergeCharacterRoster();
  populateDynamicFilterOptions();
  renderCharacterCards();
}

/* ========================================================================== */
/* EVENT LISTENERS & INITIALIZATION                                           */
/* ========================================================================== */

function setupEventListeners() {
  // Search and Filter Controls
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderCharacterCards();
  });

  document.getElementById('classFilter').addEventListener('change', (e) => {
    state.filters.className = e.target.value;
    renderCharacterCards();
  });

  document.getElementById('specFilter').addEventListener('change', (e) => {
    state.filters.specName = e.target.value;
    renderCharacterCards();
  });

  document.getElementById('statusFilter').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    renderCharacterCards();
  });

  const resetAllFilters = () => {
    state.filters = { search: '', className: 'ALL', specName: 'ALL', status: 'ALL' };
    document.getElementById('searchInput').value = '';
    document.getElementById('classFilter').value = 'ALL';
    document.getElementById('specFilter').value = 'ALL';
    document.getElementById('statusFilter').value = 'ALL';
    renderCharacterCards();
  };

  document.getElementById('resetFiltersBtn').addEventListener('click', resetAllFilters);
  document.getElementById('emptyStateResetBtn').addEventListener('click', resetAllFilters);

  // Header Actions
  document.getElementById('refreshSnapshotBtn').addEventListener('click', () => {
    fetchStaticSnapshot();
  });

  document.getElementById('forceSyncApiBtn')?.addEventListener('click', () => {
    triggerWorkflowSync();
  });

  document.getElementById('openPatSettingsBtn')?.addEventListener('click', () => {
    openSettingsModal();
  });

  document.getElementById('openAddPlayerModalBtn').addEventListener('click', openAddPlayerModal);
  document.getElementById('exportJsonBtn').addEventListener('click', openExportJsonModal);

  // Detail Modal Close & Delete Local Character
  document.getElementById('closeDetailModalBtn').addEventListener('click', closeCharacterDetailModal);
  document.getElementById('characterDetailModal').addEventListener('click', (e) => {
    if (e.target.id === 'characterDetailModal') {
      closeCharacterDetailModal();
    }
  });

  document.getElementById('deleteLocalCharBtn').addEventListener('click', () => {
    if (!state.activeCharacterId) return;
    state.localEntries = state.localEntries.filter(entry => {
      const entryId = `${HARDCODED_REGION}-${HARDCODED_REALM_SLUG}-${entry.name.toLowerCase()}`;
      return entryId !== state.activeCharacterId.toLowerCase();
    });
    saveLocalEntries(state.localEntries);
    closeCharacterDetailModal();
    mergeCharacterRoster();
    populateDynamicFilterOptions();
    renderCharacterCards();
  });

  // Add Player Modal Listeners
  document.getElementById('closeAddPlayerModalBtn').addEventListener('click', closeAddPlayerModal);
  document.getElementById('cancelAddPlayerBtn').addEventListener('click', closeAddPlayerModal);
  document.getElementById('addPlayerModal').addEventListener('click', (e) => {
    if (e.target.id === 'addPlayerModal') {
      closeAddPlayerModal();
    }
  });

  // Live preview of First Name + Optional Second Name hyphenation
  document.getElementById('charFirstNameInput')?.addEventListener('input', updateCharacterNamePreview);
  document.getElementById('charSecondNameInput')?.addEventListener('input', updateCharacterNamePreview);

  // Submit Add Player Form (First Name + Optional Second Name; auto-hyphenated; Realm: maladath, Region: us)
  document.getElementById('addPlayerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const sanitizedName = combineFirstAndSecondName(
      formData.get('firstName'),
      formData.get('secondName')
    );
    if (!sanitizedName) return;

    const cleanEntry = {
      name: sanitizedName,
      realm: HARDCODED_REALM_SLUG,
      region: HARDCODED_REGION
    };

    state.localEntries = state.localEntries.filter(
      item => item.name.toLowerCase() !== sanitizedName
    );
    state.localEntries.unshift(cleanEntry);
    saveLocalEntries(state.localEntries);

    e.target.reset();
    updateCharacterNamePreview();
    closeAddPlayerModal();
    mergeCharacterRoster();
    populateDynamicFilterOptions();
    renderCharacterCards();
  });

  // Export JSON Modal Listeners
  document.getElementById('closeExportJsonModalBtn').addEventListener('click', closeExportJsonModal);
  document.getElementById('exportJsonModal').addEventListener('click', (e) => {
    if (e.target.id === 'exportJsonModal') {
      closeExportJsonModal();
    }
  });

  // GitHub PAT Settings Modal Listeners
  document.getElementById('closePatSettingsModalBtn')?.addEventListener('click', closeSettingsModal);
  document.getElementById('cancelPatSettingsBtn')?.addEventListener('click', closeSettingsModal);
  document.getElementById('patSettingsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'patSettingsModal') {
      closeSettingsModal();
    }
  });

  document.getElementById('clearPatBtn')?.addEventListener('click', () => {
    localStorage.removeItem('gh_pat');
    const input = document.getElementById('ghPatInput');
    if (input) input.value = '';
    showToast('Cleared saved GitHub Personal Access Token from browser storage.', 'info');
  });

  document.getElementById('patSettingsForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('ghPatInput');
    const token = String(input?.value || '').trim();
    if (!token) {
      showToast('Please enter a valid GitHub Personal Access Token.', 'error');
      return;
    }
    localStorage.setItem('gh_pat', token);
    closeSettingsModal();
    triggerWorkflowSync();
  });

  document.getElementById('copyExportJsonBtn').addEventListener('click', async () => {
    const textarea = document.getElementById('exportJsonTextarea');
    const confirmEl = document.getElementById('copyConfirmMessage');
    try {
      await navigator.clipboard.writeText(textarea.value);
    } catch {
      textarea.select();
      document.execCommand('copy');
    }
    confirmEl.classList.remove('opacity-0');
    setTimeout(() => confirmEl.classList.add('opacity-0'), 2500);
  });

  document.getElementById('downloadJsonFileBtn').addEventListener('click', () => {
    const textarea = document.getElementById('exportJsonTextarea');
    const blob = new Blob([textarea.value + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'characters.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Global ESC Key Accessibility for Modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCharacterDetailModal();
      closeAddPlayerModal();
      closeExportJsonModal();
      closeSettingsModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  fetchStaticSnapshot();
});
