/**
 * fetch-stats.js
 * ----------------------------------------------------------------------------
 * Automated Battle.net Profile Snapshot Updater for WoW Forever PvP.
 * Authenticates via OAuth2 client_credentials and queries Forever / Classic
 * ruleset namespaces and PvP realm slugs for each primary character name.
 */

const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.BNET_CLIENT_ID;
const CLIENT_SECRET = process.env.BNET_CLIENT_SECRET;

const TARGET_NAMESPACES = [
  'profile-forever-us',
  'profile-classic1x-us',
  'profile-classicann-us',
  'profile-us'
];

const TARGET_REALM_SLUGS = [
  'pvp',
  'forever-pvp',
  'maladath'
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
    if (!res.ok) return { status: res.status, data: null };
    const data = await res.json();
    return { status: 200, data };
  } catch (err) {
    return { status: 500, error: err.message, data: null };
  }
}

/**
 * Sanitize character name to extract the primary first name from any hyphenated
 * or multi-word string (e.g. "slamson-slamson" -> "slamson").
 */
function extractPrimaryFirstName(rawName) {
  return String(rawName || '')
    .trim()
    .toLowerCase()
    .split(/[-\s]+/)[0];
}

async function run() {
  console.log('=== WoW Forever PvP: Character Snapshot Updater ===');
  const token = await getAccessToken();
  console.log('Successfully acquired Battle.net OAuth2 access token.');

  const rosterPath = path.join(__dirname, 'characters.json');
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));

  const results = [];

  for (const char of roster) {
    const firstName = extractPrimaryFirstName(char.name);
    if (!firstName) continue;

    console.log(`\nResolving character: ${firstName} (Ruleset: PvP)...`);

    // Combine any custom realm in characters.json with the Forever PvP candidate slugs
    const slugCandidates = Array.from(new Set([
      ...TARGET_REALM_SLUGS,
      String(char.realm || 'pvp').trim().toLowerCase()
    ]));

    let foundSummary = null;
    let validNamespace = null;
    let validSlug = null;

    searchLoop:
    for (const namespace of TARGET_NAMESPACES) {
      for (const slug of slugCandidates) {
        const url = `https://us.api.blizzard.com/profile/wow/character/${encodeURIComponent(slug)}/${encodeURIComponent(firstName)}?namespace=${namespace}&locale=en_US`;
        const res = await fetchJson(url, token);
        if (res.status === 200 && res.data) {
          foundSummary = res.data;
          validNamespace = namespace;
          validSlug = slug;
          console.log(`  -> SUCCESS! Found [${firstName}] on slug [${slug}], namespace [${namespace}]`);
          break searchLoop;
        }
      }
    }

    if (!foundSummary) {
      console.warn(`  [404 / Pending] Profile for "${firstName}" is not yet indexed or published by Blizzard Armory. Outputting PvP placeholder card.`);
      results.push({
        name: firstName,
        realm: 'PvP',
        region: 'us',
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
          crit: 0,
          haste: 0,
          mastery: 0,
          versatility: 0
        },
        pending: true,
        lastUpdated: new Date().toISOString()
      });
      continue;
    }

    // Retrieve character media and statistics using the verified namespace and slug
    const base = `https://us.api.blizzard.com/profile/wow/character/${encodeURIComponent(validSlug)}/${encodeURIComponent(firstName)}`;
    const [mediaRes, statsRes] = await Promise.all([
      fetchJson(`${base}/character-media?namespace=${validNamespace}&locale=en_US`, token),
      fetchJson(`${base}/statistics?namespace=${validNamespace}&locale=en_US`, token)
    ]);

    const media = mediaRes.data;
    const stats = statsRes.data;

    const avatar =
      media?.assets?.find(a => a.key === 'avatar')?.value ||
      media?.avatar_url ||
      '';

    const critVal = stats?.crit?.value ?? stats?.spell_crit?.value ?? stats?.melee_crit?.value ?? 0;
    const hasteVal = stats?.haste?.value ?? stats?.spell_haste?.value ?? stats?.melee_haste?.value ?? 0;
    const masteryVal = stats?.mastery?.value ?? 0;
    const versatilityVal = stats?.versatility ?? stats?.versatility_damage_done_bonus ?? 0;

    results.push({
      name: foundSummary.name || firstName,
      realm: foundSummary.realm?.name || 'PvP',
      region: 'us',
      level: foundSummary.level || 1,
      race: foundSummary.race?.name || 'Unknown',
      class: foundSummary.character_class?.name || 'Adventurer',
      spec: foundSummary.active_spec?.name || 'PvP',
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
        strength: stats?.strength?.effective || 0,
        agility: stats?.agility?.effective || 0,
        intellect: stats?.intellect?.effective || 0,
        stamina: stats?.stamina?.effective || 0,
        crit: Number(Number(critVal).toFixed(1)),
        haste: Number(Number(hasteVal).toFixed(1)),
        mastery: Number(Number(masteryVal).toFixed(1)),
        versatility: Number(Number(versatilityVal).toFixed(1))
      },
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
