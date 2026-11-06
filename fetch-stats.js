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

async function run() {
  const token = await getAccessToken();
  console.log('=== Checking Maladath (6539) Connected Realm Details ===');

  // Check the dynamic connected realm endpoint for classicann
  const crUrl = 'https://us.api.blizzard.com/data/wow/connected-realm/6539?namespace=dynamic-classicann-us&locale=en_US';
  const crRes = await fetch(crUrl, { headers: { Authorization: `Bearer ${token}` } });
  
  if (crRes.ok) {
    const crData = await crRes.json();
    console.log('Connected Realm Data Found:');
    console.log('Status:', crData.status?.name);
    console.log('Realms included:', crData.realms?.map(r => ({ name: r.name, slug: r.slug, id: r.id })));
  } else {
    console.log(`Connected Realm 6539 returned HTTP ${crRes.status}`);
  }

  // Probe "nuff" across all three Anniversary realms to test if character profiling is active
  console.log('\n=== Probing Anniversary Realms for "nuff" ===');
  const testRealms = ['nightslayer', 'dreamscythe', 'maladath'];
  for (const r of testRealms) {
    const url = `https://us.api.blizzard.com/profile/wow/character/${r}/nuff?namespace=profile-classicann-us&locale=en_US`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`Probe [${r}/nuff] on profile-classicann-us: HTTP ${res.status}`);
  }
}

run().catch(console.error);
