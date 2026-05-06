import fs from 'fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

async function fetchText(url) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } });
    return await r.text();
}

function extractAppIds(html) {
    const ids = [];
    const re = /data-ds-appid="(\d+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) ids.push(Number(m[1]));
    return ids;
}

async function gatherIds(target = 750) {
    const ids = new Set();
    const bases = [
        'https://store.steampowered.com/search/?sort_by=Reviews_DESC&category1=998&supportedlang=english&hide_filtered_results_warning=1',
        'https://store.steampowered.com/search/?filter=topsellers&category1=998&supportedlang=english&hide_filtered_results_warning=1',
        'https://store.steampowered.com/search/?sort_by=_ASC&category1=998&supportedlang=english&hide_filtered_results_warning=1',
    ];
    for (const base of bases) {
        for (let start = 0; start < 12000 && ids.size < target; start += 50) {
            const url = `${base}&start=${start}&count=50`;
            try {
                const html = await fetchText(url);
                const chunk = extractAppIds(html);
                if (!chunk.length) break;
                for (const id of chunk) ids.add(id);
            } catch {
                break;
            }
            await new Promise((r) => setTimeout(r, 120));
        }
    }
    return [...ids];
}

async function appDetails(id) {
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

async function poolMap(items, concurrency, fn) {
    const out = [];
    let i = 0;
    async function worker() {
        while (i < items.length) {
            const idx = i++;
            const res = await fn(items[idx], idx);
            if (res) out.push(res);
        }
    }
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
    return out;
}

const rawIds = await gatherIds(900);
const uniq = [...new Set(rawIds)].slice(0, 900);

const detailed = await poolMap(uniq, 10, async (id) => {
    await new Promise((r) => setTimeout(r, 55));
    try {
        return await appDetails(id);
    } catch {
        return null;
    }
});

detailed.sort((a, b) => a.game.localeCompare(b.game));
const games = detailed.slice(0, 620);

const outPath = new URL('../games.json', import.meta.url);
fs.writeFileSync(outPath, JSON.stringify(games));
console.log('wrote', games.length, 'games to', outPath.pathname);
