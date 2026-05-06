const r = await fetch('https://steamdb.info/charts/?sort=players', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
});
const t = await r.text();
const ids = [...t.matchAll(/data-appid="(\d+)"/g)].map((m) => Number(m[1]));
console.log('count', ids.length, 'sample', ids.slice(0, 15));
