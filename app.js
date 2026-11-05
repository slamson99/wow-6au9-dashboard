/**
 * app.js
 * ----------------------------------------------------------------------------
 * Client-side application logic for the WoW Forever Roster Dashboard.
 * - Loads static snapshot data from ./data/stats.json
 * - Merges locally tracked characters from localStorage
 * - Supports searching, class/spec/status filtering, and responsive modals
 * - Formats relative timestamps, official WoW class colors, and item quality borders
 * - Exports combined characters.json for repository synchronization
 */

const LOCAL_STORAGE_KEY = 'wow_forever_local_characters_v1';
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

/** Default Primary Attribute per Class */
const CLASS_PRIMARY_STAT = {
  'Death Knight': 'Strength',
  'Paladin': 'Strength',
  'Warrior': 'Strength',
  'Demon Hunter': 'Agility',
  'Hunter': 'Agility',
  'Monk': 'Agility',
  'Rogue': 'Agility',
  'Druid': 'Intellect',
  'Evoker': 'Intellect',
  'Mage': 'Intellect',
  'Priest': 'Intellect',
  'Shaman': 'Intellect',
  'Warlock': 'Intellect'
};

/** 16 Armory Slots for Paper-Doll Generation */
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
  localCharacters: [],
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
  return WOW_CLASS_ICONS[className] || WOW_CLASS_ICONS['Warrior'];
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
    return 'Offline';
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

/**
 * Format realm slug (e.g., "area-52") into display name ("Area 52").
 */
function formatRealmDisplayName(slug) {
  if (!slug) return 'Unknown Realm';
  return String(slug)
    .trim()
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/* ========================================================================== */
/* LOCAL STORAGE & MERGE LOGIC                                                */
/* ========================================================================== */

function loadLocalCharacters() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse local characters from localStorage:', err);
    return [];
  }
}

function saveLocalCharacters(list) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save local characters to localStorage:', err);
  }
}

/**
 * Build a complete character profile object for a user-added character
 * so it seamlessly renders in both cards and the 16-slot detail modal.
 */
function buildLocalCharacterProfile(formInput) {
  const cleanName = formInput.name.trim();
  const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  const cleanRealmSlug = formInput.realm.trim().toLowerCase().replace(/\s+/g, '-');
  const cleanRegion = (formInput.region || 'us').toLowerCase();
  const className = formInput.class || 'Warrior';
  const specName = formInput.spec?.trim() || 'General';
  const raceName = formInput.race?.trim() || 'Azerothian';
  const level = Math.min(80, Math.max(1, parseInt(formInput.level || '80', 10)));
  const ilvl = Math.min(700, Math.max(1, parseInt(formInput.ilvl || '615', 10)));
  const zoneName = formInput.zone?.trim() || 'Orgrimmar / Stormwind';

  const id = `${cleanRegion}-${cleanRealmSlug}-${cleanName.toLowerCase()}`;
  const primaryStatName = CLASS_PRIMARY_STAT[className] || 'Strength';
  const scaledPrimary = Math.round(ilvl * 76);
  const scaledStamina = Math.round(ilvl * 225);

  const equipment = ARMORY_SLOTS.map(slotDef => ({
    slot: slotDef.slot,
    slot_name: slotDef.slot_name,
    name: `${formattedName}'s ${slotDef.slot_name} of the Realm`,
    item_level: ilvl,
    quality: ilvl >= 620 ? 'EPIC' : ilvl >= 590 ? 'RARE' : 'UNCOMMON',
    icon: slotDef.icon,
    enchant: 'Pending Battle.net Sync'
  }));

  return {
    id,
    is_local: true,
    name: formattedName,
    title: 'Champion %s',
    formatted_title: `Champion ${formattedName}`,
    realm: {
      name: formatRealmDisplayName(cleanRealmSlug),
      slug: cleanRealmSlug
    },
    region: cleanRegion,
    faction: 'Azeroth',
    race: raceName,
    class: className,
    active_spec: specName,
    level,
    equipped_item_level: ilvl,
    average_item_level: ilvl,
    achievement_points: 12500,
    last_login_timestamp: Date.now(),
    is_online: true,
    location: zoneName,
    guild: {
      name: 'Locally Tracked Roster',
      rank: 'Pending GitHub Action Sync',
      realm: formatRealmDisplayName(cleanRealmSlug)
    },
    media: {
      avatar: getClassIcon(className),
      inset: getClassIcon(className),
      main_raw: getClassIcon(className)
    },
    stats: {
      health: scaledStamina * 40,
      resource_type: 'Resource',
      resource_amount: 100,
      strength: primaryStatName === 'Strength' ? scaledPrimary : 1450,
      agility: primaryStatName === 'Agility' ? scaledPrimary : 1620,
      intellect: primaryStatName === 'Intellect' ? scaledPrimary : 1380,
      stamina: scaledStamina,
      armor: Math.round(ilvl * 22),
      crit: 25.0,
      haste: 22.5,
      mastery: 34.0,
      versatility: 10.5,
      primary_stat_name: primaryStatName,
      primary_stat_value: scaledPrimary
    },
    equipment,
    activity: {
      quests_completed_total: 4200,
      hours_active_estimate: 850,
      recent_quests: [
        { title: 'Awaiting Automated GitHub Actions Sync', zone: zoneName, status: 'Local Entry' },
        { title: 'Export characters.json to Track via Battle.net API', zone: 'GitHub Repository', status: 'Setup Guide' }
      ]
    }
  };
}

/**
 * Merge static characters from `./data/stats.json` with locally added characters.
 * If a locally added character now exists in `stats.json`, the official snapshot takes precedence.
 */
function mergeCharacterRoster() {
  const byId = new Map();

  for (const staticChar of state.staticCharacters) {
    if (staticChar && staticChar.id) {
      byId.set(staticChar.id.toLowerCase(), { ...staticChar, is_local: false });
    }
  }

  for (const localChar of state.localCharacters) {
    if (localChar && localChar.id) {
      const key = localChar.id.toLowerCase();
      if (!byId.has(key)) {
        byId.set(key, { ...localChar, is_local: true });
      }
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

  countEl.textContent = `${totalCount} Champions (${onlineCount} Online${localCount > 0 ? ` • ${localCount} Local` : ''})`;

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
      <span>Offline / Local Roster Mode</span>
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
    const primaryStatVal = formatNumber(char.stats?.primary_stat_value || 0);
    const staminaVal = formatNumber(char.stats?.stamina || 0);
    const ilvl = char.equipped_item_level || 0;
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
                  ${escapeHtml((char.region || 'us').toUpperCase())}
                </span>
                <span class="truncate font-medium">${escapeHtml(char.realm?.name || char.realm?.slug)}</span>
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
            <span class="text-slate-300 truncate" title="${escapeHtml(char.location || 'Azeroth')}">
              ${escapeHtml(char.location || 'Azeroth')}
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
          <span class="truncate">${escapeHtml(char.guild?.name ? `<${char.guild.name}>` : 'Unguilded Champion')}</span>
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

  document.getElementById('detailModalLevelBadge').textContent = `Lv ${char.level || 80}`;

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
    : 'No Guild Affiliation';

  document.getElementById('detailModalRealmLine').textContent =
    `${char.realm?.name || char.realm?.slug} (${(char.region || 'us').toUpperCase()})`;

  // Summary Ribbon
  document.getElementById('detailModalIlvl').textContent = char.equipped_item_level || 0;
  document.getElementById('detailModalAvgIlvl').textContent = `(${char.average_item_level || char.equipped_item_level || 0} Avg)`;
  document.getElementById('detailModalLocation').textContent = char.location || 'Azeroth';

  const lastSeenEl = document.getElementById('detailModalLastSeen');
  lastSeenEl.textContent = online ? 'Active in World' : relativeSeen;
  lastSeenEl.className = online
    ? 'text-sm sm:text-base font-semibold text-emerald-400 block mt-0.5'
    : 'text-sm sm:text-base font-semibold text-slate-200 block mt-0.5';

  const hoursEst = char.activity?.hours_active_estimate || 100;
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
    : [{ title: 'Adventuring across Azeroth', zone: char.location || 'Azeroth', status: 'Active' }];

  document.getElementById('detailModalQuestList').innerHTML = quests.map(q => {
    const isCurrent = String(q.status || '').toLowerCase().includes('active');
    const badgeCls = isCurrent
      ? 'bg-wowgold-500/20 text-wowgold-300 border-wowgold-500/40'
      : 'bg-slate-800 text-slate-400 border-slate-700';

    return `
      <li class="p-2.5 rounded bg-obsidian-900/90 border border-slate-800/90 flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs font-semibold text-slate-100 truncate">${escapeHtml(q.title)}</p>
          <p class="text-[11px] text-slate-400 truncate mt-0.5">${escapeHtml(q.zone || 'Azeroth')}</p>
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
        name: 'Empty Slot',
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

function openAddPlayerModal() {
  const modal = document.getElementById('addPlayerModal');
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => document.getElementById('charNameInput')?.focus(), 50);
}

function closeAddPlayerModal() {
  const modal = document.getElementById('addPlayerModal');
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function buildCharactersJsonExportPayload() {
  return state.mergedCharacters.map(c => ({
    name: c.name,
    realm: c.realm?.slug || String(c.realm?.name || 'area-52').toLowerCase().replace(/\s+/g, '-'),
    region: (c.region || 'us').toLowerCase(),
    namespace: `profile-${(c.region || 'us').toLowerCase()}`,
    notes: `${c.race || ''} ${c.active_spec || ''} ${c.class || ''}`.trim()
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
    state.snapshotUpdatedAt = payload.updated_at || null;
  } catch (err) {
    console.warn('Could not load ./data/stats.json snapshot:', err.message);
  } finally {
    if (refreshIcon) {
      setTimeout(() => refreshIcon.classList.remove('animate-spin'), 350);
    }
  }

  state.localCharacters = loadLocalCharacters();
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
    state.localCharacters = state.localCharacters.filter(c => c.id !== state.activeCharacterId);
    saveLocalCharacters(state.localCharacters);
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

  document.getElementById('addPlayerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newChar = buildLocalCharacterProfile({
      name: formData.get('name'),
      realm: formData.get('realm'),
      region: formData.get('region'),
      class: formData.get('class'),
      spec: formData.get('spec'),
      race: formData.get('race'),
      level: formData.get('level'),
      ilvl: formData.get('ilvl'),
      zone: formData.get('zone')
    });

    // Replace existing local entry with same ID or append
    state.localCharacters = state.localCharacters.filter(c => c.id.toLowerCase() !== newChar.id.toLowerCase());
    state.localCharacters.unshift(newChar);
    saveLocalCharacters(state.localCharacters);

    e.target.reset();
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
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  fetchStaticSnapshot();
});
