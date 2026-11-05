const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.BNET_CLIENT_ID;
const CLIENT_SECRET = process.env.BNET_CLIENT_SECRET;

async function getAccessToken() {
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
  if (!data.access_token) throw new Error('Failed to acquire Battle.net access token');
  return data.access_token;
}

async function fetchJson(url, token) {
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return { status: res.status, data: null };
    const data = await res.json();
    return { status: 200, data };
  } catch (err) {
    return { status: 500, error: err.message };
  }
}

/**
 * Probe Blizzard Realm Index across Classic Era / Anniversary / Progression / Retail namespaces
 * to discover the exact realm slug & profile namespace for Maladath / Oceanic PvP.
 */
async function discoverRealmsFromIndex(token) {
  const dynamicNamespaces = [
    'dynamic-classic1x-us',
    'dynamic-classicann-us',
    'dynamic-classic-us',
    'dynamic-us'
  ];

  const discoveredPairs = []; // Array of { profileNs, slug, name }

  console.log('\n=== Probing Blizzard Realm Index for PvP / Maladath ===');

  for (const dynNs of dynamicNamespaces) {
    console.log(`\nChecking namespace: ${dynNs}...`);
    const url = `https://us.api.blizzard.com/data/wow/realm/index?namespace=${dynNs}&locale=en_US`;
    const res = await fetchJson(url, token);
    if (res.status !== 200 || !res.data) {
      console.log(`  Failed to load ${dynNs} (HTTP ${res.status})`);
      continue;
    }

    const realms = res.data.realms || [];
    console.log(`  Found ${realms.length} realms.`);

    const profileNs = dynNs.replace(/^dynamic-/, 'profile-');

    // Log all realms in Classic namespaces or matching maladath/pvp/au
    const matches = realms.filter(r => {
      const n = (r.name || '').toLowerCase();
      const s = (r.slug || '').toLowerCase();
      return (
        n.includes('maladath') ||
        s.includes('maladath') ||
        s.includes('pvp') ||
        s.endsWith('-au') ||
        dynNs.includes('classic1x') ||
        dynNs.includes('classicann')
      );
    });

    matches.forEach(m => {
      console.log(`  -> Match [${dynNs}]: Name="${m.name}", Slug="${m.slug}", ID=${m.id}`);
      if (
        m.name.toLowerCase().includes('maladath') ||
        m.slug.toLowerCase().includes('maladath') ||
        m.slug.toLowerCase().includes('pvp') ||
        m.slug.toLowerCase().endsWith('-au')
      ) {
        discoveredPairs.push({
          profileNs,
          slug: m.slug,
          name: m.name
        });
      }
    });
  }

  return discoveredPairs;
}

async function run() {
  console.log('=== WoW Character Snapshot Updater ===');
  const token = await getAccessToken();
  console.log('Successfully acquired Battle.net OAuth2 access token.');

  // 1. Probe Realm Index first to log exact slugs & discover any dynamic realm slugs
  const discoveredRealms = await discoverRealmsFromIndex(token);

  const rosterPath = path.join(__dirname, 'characters.json');
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));

  const results = [];

  // Namespaces to probe in order of likelihood for Classic / Forever
  const namespaces = [
    'profile-classic1x-us',
    'profile-classic-us',
    'profile-classicann-us',
    'profile-us'
  ];

  for (const char of roster) {
    console.log(`\nResolving character: ${char.name} (${char.realm})...`);

    // Probe both the raw name and the single first name if hyphenated
    const nameCandidates = [
      char.name.toLowerCase().trim(),
      char.name.split('-')[0].toLowerCase().trim()
    ].filter((v, i, a) => a.indexOf(v) === i);

    // Realm slug variants (including any discovered slugs from the realm index)
    const realmCandidates = [
      char.realm.toLowerCase().trim(),
      `${char.realm.toLowerCase().trim()}-au`,
      ...discoveredRealms.map(d => d.slug)
    ].filter((v, i, a) => a.indexOf(v) === i);

    let foundSummary = null;
    let validNamespace = null;
    let validRealm = null;
    let validName = null;

    // Search through combinations until HTTP 200 is found
    searchLoop:
    for (const ns of namespaces) {
      for (const r of realmCandidates) {
        for (const n of nameCandidates) {
          const url = `https://us.api.blizzard.com/profile/wow/character/${encodeURIComponent(r)}/${encodeURIComponent(n)}?namespace=${ns}&locale=en_US`;
          const res = await fetchJson(url, token);
          if (res.status === 200 && res.data) {
            foundSummary = res.data;
            validNamespace = ns;
            validRealm = r;
            validName = n;
            console.log(`  -> SUCCESS! Found on realm [${r}], name [${n}], namespace [${ns}]`);
            break searchLoop;
          }
        }
      }
    }

    if (!foundSummary) {
      console.warn(`  [404] Could not locate profile for ${char.name} across any tested namespace or realm variation.`);
      // Retain a clean placeholder object so the dashboard shows the card
      results.push({
        name: char.name,
        realm: char.realm,
        level: '?',
        class: 'Adventurer',
        spec: 'Unknown',
        equippedItemLevel: 0,
        averageItemLevel: 0,
        avatarUrl: '',
        online: false,
        lastLogin: null,
        stats: { crit: 0, haste: 0, mastery: 0, versatility: 0, stamina: 0, health: 0 },
        pending: true
      });
      continue;
    }

    // Pull media & stats using the verified working namespace
    const base = `https://us.api.blizzard.com/profile/wow/character/${encodeURIComponent(validRealm)}/${encodeURIComponent(validName)}`;
    const mediaRes = await fetchJson(`${base}/character-media?namespace=${validNamespace}&locale=en_US`, token);
    const statsRes = await fetchJson(`${base}/statistics?namespace=${validNamespace}&locale=en_US`, token);

    const media = mediaRes.data;
    const stats = statsRes.data;

    const avatar = media?.assets?.find(a => a.key === 'avatar')?.value 
                || media?.avatar_url 
                || '';

    results.push({
      name: foundSummary.name,
      realm: foundSummary.realm?.name || validRealm,
      level: foundSummary.level,
      race: foundSummary.race?.name || 'Troll',
      class: foundSummary.character_class?.name || 'Hunter',
      spec: foundSummary.active_spec?.name || 'Classic',
      equippedItemLevel: foundSummary.equipped_item_level || foundSummary.level,
      averageItemLevel: foundSummary.average_item_level || foundSummary.level,
      avatarUrl: avatar,
      lastLogin: foundSummary.last_login_timestamp ? new Date(foundSummary.last_login_timestamp).toISOString() : null,
      stats: {
        health: stats?.health || 0,
        power: stats?.power || 0,
        strength: stats?.strength?.effective || 0,
        agility: stats?.agility?.effective || 0,
        intellect: stats?.intellect?.effective || 0,
        stamina: stats?.stamina?.effective || 0,
        crit: stats?.crit?.value?.toFixed(1) || 0,
        haste: stats?.haste?.value?.toFixed(1) || 0,
        mastery: stats?.mastery?.value?.toFixed(1) || 0,
        versatility: stats?.versatility || 0
      },
      pending: false,
      lastUpdated: new Date().toISOString()
    });
  }

  const outDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    updated: new Date().toISOString(),
    discovered_realms: discoveredRealms,
    characters: results
  };

  fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(payload, null, 2));
  console.log(`\nSuccessfully wrote ${results.length} character snapshots to data/stats.json.`);
}

run().catch(err => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
