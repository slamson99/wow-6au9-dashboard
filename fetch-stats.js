/**
 * fetch-stats.js
 * ----------------------------------------------------------------------------
 * Automated Battle.net Profile Snapshot Updater for Maladath (ID: 6539, classicann).
 * Authenticates via OAuth2 client_credentials and probes `profile-classicann-us`
 * first (along with Classic fallback namespaces) with detailed HTTP status logging.
 */

const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.BNET_CLIENT_ID;
const CLIENT_SECRET = process.env.BNET_CLIENT_SECRET;

const TARGET_NAMESPACES = [
  'profile-classicann-us',
  'profile-classic-us',
  'profile-classic1x-us'
];

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

async function getAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing BNET_CLIENT_ID or BNET_CLIENT_SECRET environment variables');
  }

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Failed to acquire Battle.net access token');
  }
  return data.access_token;
}

async function fetchJson(url, token) {
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return { status: res.status, data: null, errorText };
    }
    const data = await res.json();
    return { status: 200, data };
  } catch (err) {
    return { status: 500, error: err.message, data: null };
  }
}

/**
 * Sanitize character name to strictly extract the primary first name
 * (no surnames or hyphens, e.g. "slamson-slamson" -> "slamson").
 */
function extractPrimaryFirstName(rawName) {
  return String(rawName || '')
    .trim()
    .toLowerCase()
    .split(/[-\s]+/)[0];
}

async function run() {
  console.log('=== WoW Maladath (Classic Anniversary / Forever) Snapshot Updater ===');
  const token = await getAccessToken();
  console.log('Successfully acquired Battle.net OAuth2 access token.');

  const rosterPath = path.join(__dirname, 'characters.json');
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));

  const results = [];

  for (const char of roster) {
    const firstName = extractPrimaryFirstName(char.name);
    const realmSlug = String(char.realm || 'maladath').trim().toLowerCase();
    const region = String(char.region || 'us').trim().toLowerCase();

    if (!firstName) continue;

    console.log(`\n------------------------------------------------------------`);
    console.log(`Resolving character: "${firstName}" on realm "${realmSlug}" (${region.toUpperCase()})`);

    let foundSummary = null;
    let validNamespace = null;

    for (const namespace of TARGET_NAMESPACES) {
      const url = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(firstName)}?namespace=${namespace}&locale=en_US`;
      console.log(`  [PROBE] GET ${url}`);
      const res = await fetchJson(url, token);
      console.log(`  [STATUS] HTTP ${res.status} (${namespace})`);

      if (res.status === 200 && res.data) {
        foundSummary = res.data;
        validNamespace = namespace;
        console.log(`  -> SUCCESS! Resolved "${foundSummary.name}" (Level ${foundSummary.level} ${foundSummary.race?.name || ''} ${foundSummary.character_class?.name || ''}) in [${namespace}]`);
        break;
      }
    }

    if (!foundSummary) {
      console.warn(`  [404 / Pending] "${firstName}" on "${realmSlug}" is not yet indexed by Blizzard Armory (characters must be >= Lv 10 and logged out recently). Writing placeholder card.`);
      results.push({
        name: firstName,
        realm: 'Maladath',
        region,
        level: '?',
        race: 'Pending API Sync',
        class: 'Adventurer',
        spec: 'Unknown',
        equippedItemLevel: 0,
        averageItemLevel: 0,
        avatarUrl: '',
        online: false,
        lastLogin: null,
        stats: {
          health: 0,
          power: 0,
          strength: 0,
          agility: 0,
          intellect: 0,
          stamina: 0,
          armor: 0,
          crit: 0,
          haste: 0,
          mastery: 0,
          versatility: 0
        },
        equipment: [],
        pending: true,
        lastUpdated: new Date().toISOString()
      });
      continue;
    }

    // Pull character media, statistics, and equipment using the verified namespace
    const base = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(firstName)}`;
    const [mediaRes, statsRes, equipRes] = await Promise.all([
      fetchJson(`${base}/character-media?namespace=${validNamespace}&locale=en_US`, token),
      fetchJson(`${base}/statistics?namespace=${validNamespace}&locale=en_US`, token),
      fetchJson(`${base}/equipment?namespace=${validNamespace}&locale=en_US`, token)
    ]);

    console.log(`  [SUB-ENDPOINTS] Media: HTTP ${mediaRes.status} | Statistics: HTTP ${statsRes.status} | Equipment: HTTP ${equipRes.status}`);

    const media = mediaRes.data;
    const stats = statsRes.data;
    const equipData = equipRes.data;

    const avatar =
      media?.assets?.find(a => a.key === 'avatar')?.value ||
      media?.avatar_url ||
      '';

    const critVal = stats?.spell_crit?.value ?? stats?.melee_crit?.value ?? stats?.ranged_crit?.value ?? stats?.crit?.value ?? 0;
    const hasteVal = stats?.spell_haste?.value ?? stats?.melee_haste?.value ?? stats?.ranged_haste?.value ?? stats?.haste?.value ?? 0;
    const masteryVal = stats?.mastery?.value ?? 0;
    const versatilityVal = stats?.versatility ?? stats?.versatility_damage_done_bonus ?? 0;

    // Parse equipped items if available
    const equippedItemsRaw = equipData?.equipped_items || [];
    const equippedBySlot = new Map();
    for (const item of equippedItemsRaw) {
      if (item.slot?.type) {
        equippedBySlot.set(item.slot.type, item);
      }
    }

    const equipment = SLOT_ORDER.map(slotDef => {
      const rawItem = equippedBySlot.get(slotDef.key);
      if (!rawItem) {
        return {
          slot: slotDef.key,
          slot_name: slotDef.label,
          name: 'Empty Slot',
          item_level: 0,
          quality: 'POOR',
          icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg',
          enchant: null
        };
      }
      const enchantText = Array.isArray(rawItem.enchantments) && rawItem.enchantments.length > 0
        ? rawItem.enchantments.map(e => e.display_string).filter(Boolean).join(', ')
        : null;
      return {
        slot: slotDef.key,
        slot_name: slotDef.label,
        name: rawItem.name || slotDef.label,
        item_level: rawItem.level?.value || foundSummary.equipped_item_level || foundSummary.level || 0,
        quality: rawItem.quality?.type || 'COMMON',
        icon: 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg',
        enchant: enchantText
      };
    });

    results.push({
      name: foundSummary.name || firstName,
      realm: foundSummary.realm?.name || 'Maladath',
      region,
      faction: foundSummary.faction?.name || 'Azeroth',
      level: foundSummary.level || 1,
      race: foundSummary.race?.name || 'Unknown',
      class: foundSummary.character_class?.name || 'Adventurer',
      spec: foundSummary.active_spec?.name || 'Classic',
      guild: foundSummary.guild?.name
        ? { name: foundSummary.guild.name, rank: 'Guild Member', realm: 'Maladath' }
        : null,
      equippedItemLevel: foundSummary.equipped_item_level || foundSummary.level || 0,
      averageItemLevel: foundSummary.average_item_level || foundSummary.level || 0,
      avatarUrl: avatar,
      online: false,
      lastLogin: foundSummary.last_login_timestamp
        ? new Date(foundSummary.last_login_timestamp).toISOString()
        : null,
      stats: {
        health: stats?.health || 0,
        power: stats?.power || 0,
        strength: Math.round(stats?.strength?.effective || 0),
        agility: Math.round(stats?.agility?.effective || 0),
        intellect: Math.round(stats?.intellect?.effective || 0),
        stamina: Math.round(stats?.stamina?.effective || 0),
        armor: Math.round(stats?.armor?.effective || 0),
        crit: Number(Number(critVal).toFixed(1)),
        haste: Number(Number(hasteVal).toFixed(1)),
        mastery: Number(Number(masteryVal).toFixed(1)),
        versatility: Number(Number(versatilityVal).toFixed(1))
      },
      equipment,
      pending: false,
      lastUpdated: new Date().toISOString()
    });
  }

  const outDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const payload = {
    updated: new Date().toISOString(),
    characters: results
  };

  fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`\nSuccessfully wrote ${results.length} character snapshots to data/stats.json.`);
}

run().catch(err => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
