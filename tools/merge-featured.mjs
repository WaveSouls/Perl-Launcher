const UA = 'Mozilla/5.0';

async function featured(cc) {
    const url = `https://store.steampowered.com/api/featuredcategories/?cc=${cc}&l=english`;
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    return await r.json();
}

function collectIds(j) {
    const ids = new Set();
    const take = (arr) => {
        for (const it of arr || []) {
            if (it && it.id && it.windows_available) ids.add(it.id);
        }
    };
    take(j.specials?.items);
    take(j.top_sellers?.items);
    take(j.new_releases?.items);
    take(j.coming_soon?.items);
    return ids;
}

const regions = ['us', 'gb', 'de', 'fr', 'ca', 'au', 'pl', 'ua'];
const all = new Set();
for (const cc of regions) {
    try {
        const j = await featured(cc);
        const ids = collectIds(j);
        for (const id of ids) all.add(id);
        console.log(cc, ids.size, 'total', all.size);
    } catch (e) {
        console.error(cc, e.message);
    }
}

console.log('unique ids', all.size);
