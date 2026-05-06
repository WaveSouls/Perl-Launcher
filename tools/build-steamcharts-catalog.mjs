/**
 * Fetches SteamCharts top pages and writes games.json with Steam CDN headers.
 * Filters obvious non-game utilities when possible (still Steam store listing).
 */
import fs from 'fs';

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SKIP_NAME_SUBSTR = [
    'Godot Engine',
    'Krita',
    'Soundpad Demo',
    'Borderless Gaming',
    'Driver Booster for Steam',
    'MyDockFinder',
    '小黑盒加速器',
    'Source SDK Base',
    'Source Filmmaker',
];

function skipName(name) {
    const n = String(name);
    return SKIP_NAME_SUBSTR.some((s) => n.includes(s));
}

async function fetchPage(n) {
    const url = n === 1 ? 'https://steamcharts.com/top' : `https://steamcharts.com/top/p.${n}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return r.text();
}

function parseRows(html) {
    const rows = [];
    const re = /<a href="\/app\/(\d+)">\s*([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const steamId = Number(m[1]);
        const name = m[2].replace(/\s+/g, ' ').trim();
        if (!steamId || !name) continue;
        rows.push({ steamId, game: name });
    }
    return rows;
}

function genreBucket(name) {
    const n = name.toLowerCase();
    if (/simulator|sim\b/.test(n)) return 'Simulation';
    if (/racing|drive|forza|nfs|crew/.test(n)) return 'Racing';
    if (/football|soccer|nba|fifa|fc\b|wwe|sport/.test(n)) return 'Sports';
    if (/strategy|total war|crusader|anno|civilization/.test(n)) return 'Strategy';
    if (/rpg|final fantasy|persona|witcher|elden|dark souls|jrpg/.test(n)) return 'RPG';
    if (/fps|call of duty|battlefield|counter|apex|valorant|overwatch/.test(n)) return 'FPS';
    if (/horror|resident evil|phasmo|dead by/.test(n)) return 'Horror';
    return 'Action';
}

async function main() {
    const seen = new Set();
    const out = [];

    for (let p = 1; p <= 30; p++) {
        const html = await fetchPage(p);
        const rows = parseRows(html);
        for (const r of rows) {
            if (seen.has(r.steamId)) continue;
            if (skipName(r.game)) continue;
            seen.add(r.steamId);
            out.push({
                steamId: r.steamId,
                game: r.game,
                genre: genreBucket(r.game),
                cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${r.steamId}/header.jpg`,
            });
        }
        console.log('page', p, 'unique', out.length);
        await new Promise((x) => setTimeout(x, 120));
    }

    const target = new URL('../games.json', import.meta.url);
    fs.writeFileSync(target, JSON.stringify(out));
    console.log('saved', out.length, '→', target.pathname);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
