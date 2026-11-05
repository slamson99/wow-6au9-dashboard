/**
 * fetch-stats.js
 * ----------------------------------------------------------------------------
 * Automated Battle.net Profile Data Aggregator for WoW Forever Roster Dashboard.
 * Executed via GitHub Actions on a 2-hour schedule or manual workflow_dispatch.
 *
 * Environment Variables Required:
 *   - BNET_CLIENT_ID: Battle.net API OAuth2 Client ID
 *   - BNET_CLIENT_SECRET: Battle.net API OAuth2 Client Secret
 *   - ONLINE_THRESHOLD_MINUTES (optional): Threshold in minutes to mark online (default: 30)
 */

const fs = require('fs');
const path = require('path');

const CHARACTERS_FILE = path.join(__dirname, 'characters.json');
const OUTPUT_DIR = path.join(__dirname, 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'stats.json');

const ONLINE_THRESHOLD_MINUTES = parseInt(process.env.ONLINE_THRESHOLD_MINUTES || '30', 10);

const LOCALE_MAP = {
  us: 'en_US',
  eu: 'en_GB',
  kr: 'ko_KR',
  tw: 'zh_TW'
};

const SLOT_ORDER = [
  { key: 'HEAD', label: 'Head' },
  { key: 'NECK', label: 'Neck' },
  { key: 'SHOULDER', label: 'Shoulders' },
  { key: 'BACK', label: 'Back' },
  { key: 'CHEST', label: 'Chest' },
  { key: 'WRIST', label: 'Wrist' },
  { key: 'HANDS', label: 'Hands' },
  { key: 'WAIST', label: 'Waist' },
  { key: 'LEGS', label: 'Legs' },
  { key: 'FEET', label: 'Feet' },
  { key: 'FINGER_1', label: 'Ring 1' },
  { key: 'FINGER_2', label: 'Ring 2' },
  { key: 'TRINKET_1', label: 'Trinket 1' },
  { key: 'TRINKET_2', label: 'Trinket 2' },
  { key: 'MAIN_HAND', label: 'Main Hand' },
  { key: 'OFF_HAND', label: 'Off Hand' }
];

const CLASS_ICON_FALLBACK = {
  'Warrior': 'https://render.worldofwarcraft.com/us/icons/56/classicon_warrior.jpg',
  'Paladin': 'https://render.worldofwarcraft.com/us/icons/56/classicon_paladin.jpg',
  'Hunter': 'https://render.worldofwarcraft.com/us/icons/56/classicon_hunter.jpg',
  'Rogue': 'https://render.worldofwarcraft.com/us/icons/56/classicon_rogue.jpg',
  'Priest': 'https://render.worldofwarcraft.com/us/icons/56/classicon_priest.jpg',
  'Death Knight': 'https://render.worldofwarcraft.com/us/icons/56/classicon_deathknight.jpg',
  'Shaman': 'https://render.worldofwarcraft.com/us/icons/56/classicon_shaman.jpg',
  'Mage': 'https://render.worldofwarcraft.com/us/icons/56/classicon_mage.jpg',
  'Warlock': 'https://render.worldofwarcraft.com/us/icons/56/classicon_warlock.jpg',
  'Monk': 'https://render.worldofwarcraft.com/us/icons/56/classicon_monk.jpg',
  'Druid': 'https://render.worldofwarcraft.com/us/icons/56/classicon_druid.jpg',
  'Demon Hunter': 'https://render.worldofwarcraft.com/us/icons/56/classicon_demonhunter.jpg',
  'Evoker': 'https://render.worldofwarcraft.com/us/icons/56/classicon_evoker.jpg'
};

const FACTION_HUBS = {
  Horde: 'Orgrimmar - Valley of Strength',
  Alliance: 'Stormwind City - Trade District'
};

/**
 * Exchange BNET_CLIENT_ID and BNET_CLIENT_SECRET for an OAuth2 access token.
 */
async function getAccessToken(clientId, clientSecret) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`Battle.net OAuth2 token exchange failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Helper to fetch a Blizzard API JSON endpoint with graceful 404/error handling.
 */
async function fetchBlizzardEndpoint(url, token, label) {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (response.status === 404) {
      console.warn(`  [404 Not Found] ${label}: ${url}`);
      return { ok: false, status: 404, data: null };
    }

    if (!response.ok) {
      console.warn(`  [HTTP ${response.status}] Failed to fetch ${label}: ${url}`);
      return { ok: false, status: response.status, data: null };
    }

    const data = await response.json();
    return { ok: true, status: 200, data };
  } catch (error) {
    console.error(`  [Network Error] ${label}: ${error.message}`);
    return { ok: false, status: 0, data: null };
  }
}

/**
 * Fetch media icon for a specific item ID if not inline in equipment payload.
 */
async function fetchItemIcon(region, itemId, token, namespace, locale) {
  if (!itemId) return 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg';
  const staticNamespace = namespace.replace(/^profile-/, 'static-');
  const url = `https://${region}.api.blizzard.com/data/wow/media/item/${itemId}?namespace=${staticNamespace}&locale=${locale}`;
  const res = await fetchBlizzardEndpoint(url, token, `Item Media ${itemId}`);
  if (res.ok && res.data && Array.isArray(res.data.assets)) {
    const iconAsset = res.data.assets.find(a => a.key === 'icon') || res.data.assets[0];
    if (iconAsset && iconAsset.value) return iconAsset.value;
  }
  return 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg';
}

/**
 * Determine highest primary attribute (Strength, Agility, or Intellect).
 */
function resolvePrimaryStat(strength, agility, intellect) {
  const candidates = [
    { name: 'Strength', value: strength || 0 },
    { name: 'Agility', value: agility || 0 },
    { name: 'Intellect', value: intellect || 0 }
  ];
  candidates.sort((a, b) => b.value - a.value);
  return candidates[0];
}

/**
 * Fetch all endpoints for a single character and normalize into dashboard schema.
 */
async function fetchCharacterProfile(entry, token, previousCharactersMap) {
  const region = (entry.region || 'us').toLowerCase().trim();
  const realmSlug = (entry.realm || '').toLowerCase().trim();
  const charNameLower = encodeURIComponent((entry.name || '').toLowerCase().trim());
  const namespace = entry.namespace || `profile-${region}`;
  const locale = LOCALE_MAP[region] || 'en_US';
  const charId = `${region}-${realmSlug}-${(entry.name || '').toLowerCase().trim()}`;

  const baseUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${charNameLower}`;
  const queryParams = `namespace=${encodeURIComponent(namespace)}&locale=${locale}`;

  console.log(`\nFetching character: ${entry.name} (${realmSlug} - ${region.toUpperCase()}) [${namespace}]...`);

  // 1. Summary Profile (Required)
  const summaryRes = await fetchBlizzardEndpoint(
    `${baseUrl}?${queryParams}`,
    token,
    `Summary (${entry.name})`
  );

  if (!summaryRes.ok || !summaryRes.data) {
    console.warn(`  -> Skipping live update for ${entry.name}: Character unavailable or inactive (HTTP ${summaryRes.status}).`);
    if (previousCharactersMap.has(charId)) {
      console.log(`  -> Retaining previous cached snapshot for ${entry.name}.`);
      const cached = previousCharactersMap.get(charId);
      cached.fetch_warning = `Last API check returned HTTP ${summaryRes.status}; displaying cached snapshot.`;
      return cached;
    }
    return null;
  }

  const summary = summaryRes.data;

  // 2. Parallel requests for Media, Statistics, Equipment, and Quests
  const [mediaRes, statsRes, equipRes, questsRes] = await Promise.all([
    fetchBlizzardEndpoint(`${baseUrl}/character-media?${queryParams}`, token, `Media (${entry.name})`),
    fetchBlizzardEndpoint(`${baseUrl}/statistics?${queryParams}`, token, `Statistics (${entry.name})`),
    fetchBlizzardEndpoint(`${baseUrl}/equipment?${queryParams}`, token, `Equipment (${entry.name})`),
    fetchBlizzardEndpoint(`${baseUrl}/quests/completed?${queryParams}`, token, `Completed Quests (${entry.name})`)
  ]);

  // Parse Identity & Metadata
  const className = summary.character_class?.name || 'Warrior';
  const raceName = summary.race?.name || 'Unknown';
  const activeSpec = summary.active_spec?.name || 'General';
  const factionName = summary.faction?.name || 'Alliance';
  const lastLogin = summary.last_login_timestamp || 0;
  const nowMs = Date.now();
  const isOnline = lastLogin > 0 && (nowMs - lastLogin) <= ONLINE_THRESHOLD_MINUTES * 60 * 1000;

  // Parse Title
  const rawTitle = summary.active_title?.display_string || summary.active_title?.name || '';
  const formattedTitle = rawTitle
    ? rawTitle.replace('%s', summary.name)
    : summary.name;

  // Parse Media
  const fallbackIcon = CLASS_ICON_FALLBACK[className] || CLASS_ICON_FALLBACK['Warrior'];
  const mediaAssets = mediaRes.data?.assets || [];
  const findAsset = (key) => mediaAssets.find(a => a.key === key)?.value;
  const media = {
    avatar: findAsset('avatar') || mediaRes.data?.avatar_url || fallbackIcon,
    inset: findAsset('inset') || mediaRes.data?.bust_url || fallbackIcon,
    main_raw: findAsset('main-raw') || findAsset('main') || mediaRes.data?.render_url || fallbackIcon
  };

  // Parse Statistics
  const s = statsRes.data || {};
  const strength = Math.round(s.strength?.effective ?? 0);
  const agility = Math.round(s.agility?.effective ?? 0);
  const intellect = Math.round(s.intellect?.effective ?? 0);
  const stamina = Math.round(s.stamina?.effective ?? 0);
  const armor = Math.round(s.armor?.effective ?? 0);
  const crit = Number((s.spell_crit?.value ?? s.melee_crit?.value ?? s.ranged_crit?.value ?? 0).toFixed(2));
  const haste = Number((s.spell_haste?.value ?? s.melee_haste?.value ?? s.ranged_haste?.value ?? 0).toFixed(2));
  const mastery = Number((s.mastery?.value ?? 0).toFixed(2));
  const versatility = Number((s.versatility_damage_done_bonus ?? 0).toFixed(2));
  const primary = resolvePrimaryStat(strength, agility, intellect);

  const stats = {
    health: s.health || 0,
    resource_type: s.power_type?.name || 'Mana',
    resource_amount: s.power || 0,
    strength,
    agility,
    intellect,
    stamina,
    armor,
    crit,
    haste,
    mastery,
    versatility,
    primary_stat_name: primary.name,
    primary_stat_value: primary.value
  };

  // Parse 16-Slot Equipment
  const equippedItemsRaw = equipRes.data?.equipped_items || [];
  const equippedBySlot = new Map();
  for (const item of equippedItemsRaw) {
    if (item.slot?.type) {
      equippedBySlot.set(item.slot.type, item);
    }
  }

  const equipment = [];
  for (const slotDef of SLOT_ORDER) {
    const rawItem = equippedBySlot.get(slotDef.key);
    if (rawItem) {
      const itemId = rawItem.item?.id;
      const iconUrl = await fetchItemIcon(region, itemId, token, namespace, locale);
      const enchantText = Array.isArray(rawItem.enchantments) && rawItem.enchantments.length > 0
        ? rawItem.enchantments.map(e => e.display_string).filter(Boolean).join(', ')
        : null;

      equipment.push({
        slot: slotDef.key,
        slot_name: slotDef.label,
        item_id: itemId || null,
        name: rawItem.name || 'Unknown Item',
        item_level: rawItem.level?.value || summary.equipped_item_level || 0,
        quality: rawItem.quality?.type || 'COMMON',
        icon: iconUrl,
        enchant: enchantText
      });
    } else {
      equipment.push({
        slot: slotDef.key,
        slot_name: slotDef.label,
        item_id: null,
        name: 'Empty Slot',
        item_level: 0,
        quality: 'POOR',
        icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg',
        enchant: null
      });
    }
  }

  // Parse Quests & Location Metadata
  const completedQuestsList = questsRes.data?.quests || [];
  const totalQuestsCompleted = completedQuestsList.length;
  const recentQuestsSlice = completedQuestsList.slice(-4).reverse().map((q, idx) => ({
    title: q.name || `Story Chapter #${q.id || idx + 1}`,
    zone: summary.realm?.name || 'Azeroth',
    status: idx === 0 ? 'Latest Completed' : 'Completed Recently'
  }));

  const defaultLocation = entry.location || FACTION_HUBS[factionName] || 'Azeroth';

  return {
    id: charId,
    name: summary.name || entry.name,
    title: rawTitle,
    formatted_title: formattedTitle,
    realm: {
      name: summary.realm?.name || entry.realm,
      slug: summary.realm?.slug || realmSlug
    },
    region,
    faction: factionName,
    race: raceName,
    class: className,
    active_spec: activeSpec,
    level: summary.level || 80,
    equipped_item_level: summary.equipped_item_level || 0,
    average_item_level: summary.average_item_level || 0,
    achievement_points: summary.achievement_points || 0,
    last_login_timestamp: lastLogin,
    is_online: isOnline,
    location: defaultLocation,
    guild: summary.guild
      ? {
          name: summary.guild.name,
          rank: 'Guild Member',
          realm: summary.guild.realm?.name || summary.realm?.name || entry.realm
        }
      : null,
    media,
    stats,
    equipment,
    activity: {
      quests_completed_total: totalQuestsCompleted,
      hours_active_estimate: Math.max(12, Math.round((summary.achievement_points || 1500) / 8)),
      recent_quests: recentQuestsSlice.length > 0
        ? recentQuestsSlice
        : [
            { title: 'Champion of the Realm', zone: defaultLocation, status: 'Active Chapter' },
            { title: 'Call to Arms: Azeroth', zone: defaultLocation, status: 'Completed Recently' }
          ]
    }
  };
}

/**
 * Main entrypoint for GitHub Action execution.
 */
async function main() {
  console.log('=== WoW Forever Roster: Battle.net Snapshot Updater ===');

  if (!fs.existsSync(CHARACTERS_FILE)) {
    throw new Error(`Missing roster file at ${CHARACTERS_FILE}`);
  }

  const rosterEntries = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
  console.log(`Loaded ${rosterEntries.length} characters from characters.json.`);

  // Load existing stats.json if present so we can preserve data on partial failures or missing credentials
  const previousCharactersMap = new Map();
  let existingPayload = null;
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existingPayload = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      if (Array.isArray(existingPayload.characters)) {
        for (const c of existingPayload.characters) {
          if (c.id) previousCharactersMap.set(c.id, c);
        }
      }
    } catch (err) {
      console.warn(`Could not parse existing data/stats.json: ${err.message}`);
    }
  }

  const clientId = process.env.BNET_CLIENT_ID;
  const clientSecret = process.env.BNET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('WARNING: BNET_CLIENT_ID or BNET_CLIENT_SECRET environment variables are not set.');
    if (existingPayload) {
      console.log('Preserving existing data/stats.json snapshot and updating timestamp.');
      existingPayload.updated_at = new Date().toISOString();
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingPayload, null, 2) + '\n', 'utf8');
      return;
    } else {
      throw new Error('Cannot build initial data/stats.json without BNET_CLIENT_ID and BNET_CLIENT_SECRET.');
    }
  }

  console.log('Authenticating with Battle.net OAuth2...');
  const token = await getAccessToken(clientId, clientSecret);
  console.log('Successfully acquired Battle.net OAuth2 access token.');

  const results = [];
  for (const entry of rosterEntries) {
    if (!entry.name || !entry.realm) {
      console.warn('Skipping invalid entry in characters.json (missing name or realm):', entry);
      continue;
    }
    const profile = await fetchCharacterProfile(entry, token, previousCharactersMap);
    if (profile) {
      results.push(profile);
    }
  }

  const outputPayload = {
    updated_at: new Date().toISOString(),
    online_threshold_minutes: ONLINE_THRESHOLD_MINUTES,
    characters: results
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputPayload, null, 2) + '\n', 'utf8');
  console.log(`\nSuccessfully wrote ${results.length} character snapshots to ${OUTPUT_FILE}.`);
}

main().catch((err) => {
  console.error('\n[FATAL ERROR] Snapshot update failed:', err.message);
  process.exit(1);
});
