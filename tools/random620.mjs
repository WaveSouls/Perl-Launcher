import fs from 'fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36';

async function details(id) {
    const u = `https://store.steampowered.com/api/appdetails?appids=${id}&l=english`;
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    const j = await r.json();
    const o = j[String(id)];
    if (!o || !o.success) return null;
    const d = o.data;
    if (d.type !== 'game') return null;
    if (d.platforms && d.platforms.windows !== true) return null;
    const genre = (d.genres && d.genres[0] && d.genres[0].description) || 'PC';
    const cover =
        d.header_image ||
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;
    return { steamId: id, game: d.name, genre, cover };
}

const MUST = [
    730, 440, 570, 252490, 1172470, 1091500, 1245620, 271590, 1174180, 292030, 1086940,
    578080, 2357570, 2379390, 2358720, 1623730, 1599340, 238960, 346110, 218620, 381210,
    359550, 550, 8930, 252950, 892970, 548430, 1085660, 552990, 427520, 227300, 255710,
    374320, 814380, 582010, 782330, 230410, 105600, 413150, 976310, 1364780, 239140,
    489830, 379720, 582660, 814380, 239140, 489830, 379720, 582660, 945360, 546560,
    1817070, 1593500, 1145360, 1687950, 632360, 646570, 588650, 2767030, 2073850,
    2139460, 2507950, 1808500, 1966720, 739630, 594650, 221100, 513710, 962130, 962130,
];

const games = [];
const seen = new Set();

async function pushId(id) {
    if (seen.has(id) || games.length >= 620) return;
    seen.add(id);
    try {
        const g = await details(id);
        if (g) games.push(g);
    } catch {
        /* skip */
    }
}

for (const id of MUST) {
    await pushId(id);
}

async function tryBatch(ids) {
    await Promise.all(ids.map((id) => pushId(id)));
}

let attempts = 0;
while (games.length < 620 && attempts < 80000) {
    const batch = [];
    for (let i = 0; i < 12; i++) {
        attempts++;
        batch.push(10 + Math.floor(Math.random() * 3500000));
    }
    await tryBatch(batch);
    await new Promise((r) => setTimeout(r, 120));
}

games.sort((a, b) => a.game.localeCompare(b.game));
const out = games.slice(0, 620);
fs.writeFileSync(new URL('../games.json', import.meta.url), JSON.stringify(out));
console.log('saved', out.length, 'attempts', attempts);
