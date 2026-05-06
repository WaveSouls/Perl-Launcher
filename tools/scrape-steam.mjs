import fs from 'fs';

async function fetchHtml(url) {
    const r = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
            Accept: 'text/html',
        },
    });
    return await r.text();
}

function extractIds(html) {
    const ids = [];
    const re = /data-ds-appid="(\d+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) ids.push(Number(m[1]));
    return ids;
}

async function appDetails(id) {
    const u = `https://store.steampowered.com/api/appdetails?appids=${id}&l=english`;
    const r = await fetch(u);
    const j = await r.json();
    const o = j[String(id)];
    if (!o || !o.success) return null;
    const d = o.data;
    if (d.type !== 'game') return null;
    if (d.platforms && d.platforms.windows !== true) return null;
    const genres = (d.genres || []).map((g) => g.description);
    const genre = genres[0] || 'Game';
    return {
        steamId: id,
        game: d.name,
        genre,
        cover: d.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`,
    };
}

const seen = new Set();
const games = [];

async function addFromIds(ids) {
    for (const id of ids) {
        if (seen.has(id) || games.length >= 620) return;
        seen.add(id);
        await new Promise((r) => setTimeout(r, 140));
        try {
            const g = await appDetails(id);
            if (g) games.push(g);
        } catch {
            /* skip */
        }
        if (games.length >= 620) return;
    }
}

async function scrapePages() {
    const bases = [
        'https://store.steampowered.com/search/?sort_by=Reviews_DESC&category1=998&supportedlang=english&hide_filtered_results_warning=1',
        'https://store.steampowered.com/search/?sort_by=_ASC&category1=998&supportedlang=english&hide_filtered_results_warning=1',
        'https://store.steampowered.com/search/?filter=topsellers&category1=998&supportedlang=english&hide_filtered_results_warning=1',
    ];
    for (const base of bases) {
        for (let start = 0; start < 4000 && games.length < 620; start += 50) {
            const url = `${base}&start=${start}&count=50`;
            try {
                const html = await fetchHtml(url);
                const ids = extractIds(html);
                if (!ids.length) break;
                await addFromIds(ids);
            } catch {
                break;
            }
            await new Promise((r) => setTimeout(r, 250));
        }
    }
}

await scrapePages();

// Fallback: widen scan with coarse numeric probe if still short
const seeds = [
    730, 440, 570, 252490, 1172470, 1091500, 1245620, 271590, 1174180, 292030, 1086940,
    578080, 2357570, 2379390, 2358720, 1623730, 1599340, 238960, 346110, 218620, 381210,
    359550, 550, 8930, 252950, 892970, 548430, 1085660, 552990, 427520, 227300, 255710,
    374320, 814380, 582010, 570940, 813780, 782330, 275850, 230410, 105600, 413150,
    976310, 1364780, 239140, 489830, 489630, 379720, 582660, 814380, 374320, 374320,
];

await addFromIds(seeds);

for (let id = 50; id < 350000 && games.length < 620; id += 317) {
    if (games.length >= 620) break;
    await addFromIds([id]);
}

fs.writeFileSync(new URL('../games.json', import.meta.url), JSON.stringify(games.slice(0, 620)));
console.log('games written:', Math.min(games.length, 620));
