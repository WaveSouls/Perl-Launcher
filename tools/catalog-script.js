        /** Raw Pastebin: при каждом «Скачать» заново запрашиваем этот URL и парсим первую прямую http(s) ссылку на файл из текста. */
        const PASTEBIN_RAW = 'https://pastebin.com/raw/P3ggULWT';

        const PAGE_SIZE = 42;
        const CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

        const LANG_STORAGE = 'perl_lang';
        let currentLang =
            localStorage.getItem(LANG_STORAGE) || (/^ru\b/i.test(navigator.language || '') ? 'ru' : 'en');

        const I18N = {
            ru: {
                doc_title: 'Perl Cheats — лаунчер',
                nav_home: 'Главная',
                nav_catalog: 'Каталог',
                channel_btn: 'Наш канал',
                channel_title: 'Наш Telegram',
                hero_title: 'Perl Cheats Launcher',
                hero_desc:
                    'Лаунчер-стиль: каталог игр и неоновые акценты. Откройте «Каталог», выберите игру и нажмите «Скачать».',
                hero_btn: 'Открыть каталог',
                hero_img_alt: 'Perl Cheats Launcher',
                search_ph: 'Поиск по названию или жанру…',
                catalog_count: 'В каталоге:',
                catalog_empty:
                    'Нет данных каталога — запустите node tools/build-games-bundle.mjs или откройте сайт через локальный сервер (npm run dev)',
                footer_copy: 'Perl Cheats © 2026',
                lang_ru: 'Русский',
                lang_en: 'English',
                modal_download: 'Скачивание',
                modal_close: 'Закрыть',
                toast_dl: 'Загрузка запущена',
                err_download: 'Ошибка скачивания',
                load_more: 'Показать ещё ({n})',
                btn_download: 'Скачать',
                genre_pc: 'PC',
                pastebin_fail: 'Не удалось прочитать Pastebin. Проверьте raw-ссылку и сеть.',
                pastebin_no_url: 'В Pastebin нет прямой ссылки на файл (http/https). Фрагмент:',
            },
            en: {
                doc_title: 'Perl Cheats — launcher',
                nav_home: 'Home',
                nav_catalog: 'Catalog',
                channel_btn: 'Our channel',
                channel_title: 'Our Telegram',
                hero_title: 'Perl Cheats Launcher',
                hero_desc:
                    'Launcher-style catalog with neon accents. Open «Catalog», pick a game, tap «Download».',
                hero_btn: 'Open catalog',
                hero_img_alt: 'Perl Cheats Launcher',
                search_ph: 'Search by title or genre…',
                catalog_count: 'In catalog:',
                catalog_empty:
                    'No catalog data — run node tools/build-games-bundle.mjs or open the site via a local server (npm run dev)',
                footer_copy: 'Perl Cheats © 2026',
                lang_ru: 'Русский',
                lang_en: 'English',
                modal_download: 'Download',
                modal_close: 'Close',
                toast_dl: 'Download started',
                err_download: 'Download error',
                load_more: 'Load more ({n})',
                btn_download: 'Download',
                genre_pc: 'PC',
                pastebin_fail: 'Could not read Pastebin. Check the raw URL and your connection.',
                pastebin_no_url: 'No direct file URL (http/https) in Pastebin. Snippet:',
            },
        };

        const FEAT_POOLS_RU = [
            ['ESP целей', 'Лёгкий HUD', 'Анти-скрин слой', 'Профили FPS'],
            ['Маркировка лута', 'Минимальный след', 'Тихий оверлей', 'Совместимость DX/Vulkan'],
            ['Инфо по ресурсам', 'Таймеры боя', 'Командные метки', 'Без инжекта в процесс'],
            ['Подсказки карты', 'Безопасные зоны', 'Фото-режим чистый', 'Локальный конфиг'],
            ['Трекер дропа', 'Звуковые воронки', 'Ночной режим', 'Стабильный FPS'],
            ['Маршруты фарма', 'Фильтр редкости', 'Мини-карта+', 'Обучающий режим'],
        ];
        const FEAT_POOLS_EN = [
            ['Target ESP', 'Light HUD', 'Anti-screen layer', 'FPS profiles'],
            ['Loot tags', 'Minimal footprint', 'Quiet overlay', 'DX/Vulkan friendly'],
            ['Resource info', 'Combat timers', 'Team pings', 'No process inject'],
            ['Map hints', 'Safe zones', 'Clean photo mode', 'Local config'],
            ['Drop tracker', 'Audio cues', 'Night mode', 'Stable FPS'],
            ['Farm routes', 'Rarity filter', 'Minimap+', 'Tutorial mode'],
        ];

        function t(key) {
            const pack = I18N[currentLang] || I18N.ru;
            if (pack[key] != null) return pack[key];
            return I18N.ru[key] != null ? I18N.ru[key] : key;
        }

        function setLang(lang) {
            if (lang !== 'ru' && lang !== 'en') return;
            currentLang = lang;
            localStorage.setItem(LANG_STORAGE, lang);
            document.documentElement.setAttribute('lang', lang);
            applyStaticI18n();
            document.querySelectorAll('.lang-btn').forEach((b) => {
                b.classList.toggle('active', b.getAttribute('data-lang') === lang);
            });
            if (document.getElementById('cheats').classList.contains('active')) {
                renderGrid(document.getElementById('catalogSearch').value);
            }
        }

        function applyStaticI18n() {
            document.querySelectorAll('[data-i18n]').forEach((el) => {
                const k = el.getAttribute('data-i18n');
                if (k) el.textContent = t(k);
            });
            const ph = document.getElementById('catalogSearch');
            if (ph) ph.setAttribute('placeholder', t('search_ph'));
            document.title = t('doc_title');
            const ch = document.querySelector('[data-i18n-title-key]');
            if (ch) ch.setAttribute('title', t(ch.getAttribute('data-i18n-title-key')));
            const heroImg = document.querySelector('.launcher-image');
            if (heroImg) heroImg.setAttribute('alt', t('hero_img_alt'));
        }

        let ALL_GAMES = [];
        let gamesLoadPromise = null;
        let FILTERED = [];
        let lastFilter = '';
        let visibleCount = PAGE_SIZE;

        function cardFeatures(idx) {
            const pool = currentLang === 'en' ? FEAT_POOLS_EN : FEAT_POOLS_RU;
            return pool[idx % pool.length];
        }

        function svgBanner(title) {
            const safe = String(title).replace(/[<>&]/g, '').slice(0, 48);
            const svg =
                '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="280" viewBox="0 0 800 280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#120822"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect width="800" height="280" fill="url(#g)"/><text x="400" y="155" text-anchor="middle" fill="#ede9fe" font-family="system-ui,sans-serif" font-size="26" font-weight="700">' +
                safe +
                '</text></svg>';
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        }

        function steamUrlsForId(id) {
            const sid = String(id);
            return [
                `${CDN}/${sid}/header.jpg`,
                `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${sid}/header.jpg`,
                `https://cdn.akamai.steamstatic.com/steam/apps/${sid}/header.jpg`,
                `${CDN}/${sid}/capsule_616x353.jpg`,
                `${CDN}/${sid}/library_hero.jpg`,
                `${CDN}/${sid}/library_600x900.jpg`,
                `${CDN}/${sid}/capsule_231x87.jpg`,
            ];
        }

        window.steamImgFallback = function (img) {
            const id = img.getAttribute('data-steam');
            if (!id) {
                img.onerror = null;
                img.src = svgBanner(img.getAttribute('alt') || '');
                return;
            }
            const urls = steamUrlsForId(id);
            let step = Number(img.getAttribute('data-step') || '0');
            step += 1;
            if (step >= urls.length) {
                img.onerror = null;
                img.removeAttribute('data-step');
                img.src = svgBanner(img.getAttribute('alt') || '');
                return;
            }
            img.setAttribute('data-step', String(step));
            img.src = urls[step];
        };

        function catalogJsonCandidates() {
            const href = String(window.location.href || '').split('#')[0];
            const path = window.location.pathname || '/';
            const dir = path.endsWith('/') ? path : path.replace(/[^/]*$/, '');
            const origin = window.location.origin || '';
            const list = [
                new URL('./games.json', href).href,
                origin + dir + 'games.json',
                origin + '/games.json',
            ];
            return [...new Set(list.filter(Boolean))];
        }

        async function fetchGamesJsonArray() {
            try {
                const embedded =
                    typeof window !== 'undefined' &&
                    window.__PERL_GAMES__ &&
                    Array.isArray(window.__PERL_GAMES__) &&
                    window.__PERL_GAMES__.length > 0
                        ? window.__PERL_GAMES__
                        : null;
                if (embedded) return embedded;
            } catch (_) {
                /* fetch fallback */
            }
            for (const url of catalogJsonCandidates()) {
                try {
                    const r = await fetch(url, { cache: 'no-store' });
                    if (!r.ok) continue;
                    const ct = (r.headers.get('content-type') || '').toLowerCase();
                    if (ct.includes('html')) continue;
                    const text = await r.text();
                    const t = text.trimStart();
                    if (t.startsWith('<') || t.startsWith('<!')) continue;
                    const data = JSON.parse(text);
                    if (Array.isArray(data) && data.length > 0) return data;
                } catch (_) {
                    /* next */
                }
            }
            return [];
        }

        function loadGamesCatalog() {
            if (gamesLoadPromise) return gamesLoadPromise;
            gamesLoadPromise = fetchGamesJsonArray().then((data) => {
                ALL_GAMES = data;
                return ALL_GAMES;
            });
            return gamesLoadPromise;
        }

        function displayTitle(g) {
            return 'Perl Cheat — ' + g.game;
        }

        function cardDesc(g) {
            if (currentLang === 'en') {
                return (
                    'Profile for «' +
                    g.game +
                    '»: visual hints, HUD, and a light overlay for solo practice on PC.'
                );
            }
            return (
                'Профиль для «' +
                g.game +
                '»: визуальные подсказки, HUD и лёгкий оверлей для одиночной практики на ПК.'
            );
        }

        function bannerUrl(g) {
            if (g.steamId != null && g.steamId !== '') return steamUrlsForId(g.steamId)[0];
            if (g.cover) return g.cover;
            return svgBanner(g.game);
        }

        function hashSeed(str) {
            let h = 5381;
            for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
            return (h >>> 0).toString(16);
        }

        const DL_PERIOD_MS = 5 * 60 * 1000;

        function formatDownloads(n) {
            if (currentLang === 'en') {
                return Number(n).toLocaleString('en-US') + ' downloads';
            }
            return Number(n).toLocaleString('ru-RU') + ' загрузок';
        }

        function downloadCountNow(key, index) {
            const blocks = Math.floor(Date.now() / DL_PERIOD_MS);
            const base = 6000 + (index * 137) % 3200;
            const wave = blocks * (3 + (index % 8));
            let salt = parseInt(hashSeed(key).slice(0, 7), 16) % 211;
            if (Number.isNaN(salt)) salt = (index * 17) % 211;
            return base + wave + salt;
        }

        let dlRefreshTimer = null;
        function refreshDownloadCounts() {
            document.querySelectorAll('.js-dl-count').forEach((el) => {
                const key = el.getAttribute('data-dl-key') || '';
                const idx = Number(el.getAttribute('data-dl-idx') || '0');
                el.textContent = formatDownloads(downloadCountNow(key, idx));
            });
        }
        function startDownloadTicker() {
            refreshDownloadCounts();
            clearInterval(dlRefreshTimer);
            dlRefreshTimer = setInterval(refreshDownloadCounts, DL_PERIOD_MS);
        }

        function stars(n) {
            const full = Math.min(5, Math.max(1, Math.round(n)));
            return '★'.repeat(full) + '☆'.repeat(5 - full);
        }

        function escapeHtml(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        function escapeAttr(s) {
            return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        }

        let toastTimer = null;
        function showToast(msg) {
            const el = document.getElementById('appToast');
            if (!el) return;
            el.textContent = msg;
            el.classList.add('show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
        }

        async function renderGrid(filter) {
            await loadGamesCatalog();
            const q = (filter || '').trim().toLowerCase();
            if (q !== lastFilter) visibleCount = PAGE_SIZE;
            lastFilter = q;

            FILTERED = ALL_GAMES.filter((g) => {
                if (!q) return true;
                const blob = [g.game, g.genre || '', displayTitle(g), cardDesc(g)].join(' ').toLowerCase();
                return blob.includes(q);
            });

            if (FILTERED.length === 0 && ALL_GAMES.length === 0) {
                document.getElementById('catalogCount').textContent = t('catalog_empty');
            } else {
                document.getElementById('catalogCount').textContent = t('catalog_count') + ' ' + FILTERED.length;
            }

            const slice = FILTERED.slice(0, visibleCount);
            const grid = document.getElementById('gameGrid');
            const cards = slice
                .map((g, i) => {
                    const rating = 3 + (i % 3);
                    const feats = cardFeatures(i + (g.steamId || i)).slice(0, 4);
                    const featHtml = feats.map((f) => `<li>${escapeHtml(f)}</li>`).join('');
                    const cardTitle = displayTitle(g);
                    const dlNum = downloadCountNow(cardTitle, i);
                    const sid = g.steamId != null ? escapeAttr(String(g.steamId)) : '';
                    const imgSrc = escapeAttr(bannerUrl(g));
                    const desc = cardDesc(g);
                    return `
                <article class="game-card">
                    <div class="game-card-media">
                        <img src="${imgSrc}" alt="${escapeAttr(g.game)}" loading="lazy" decoding="async" data-steam="${sid}" data-step="0" onerror="steamImgFallback(this)"/>
                        <div class="game-card-shine"></div>
                    </div>
                    <div class="p-5">
                        <h3 class="text-xl font-bold mb-2">${escapeHtml(cardTitle)}</h3>
                        <p class="genre-tag mb-2">${escapeHtml(g.genre || t('genre_pc'))}</p>
                        <p class="text-sm mb-3" style="color: var(--muted);">${escapeHtml(desc)}</p>
                        <ul class="list-disc list-inside text-sm mb-4 space-y-1" style="color: #c4b5fd;">${featHtml}</ul>
                        <div class="flex items-center gap-2 mb-4 text-sm">
                            <span class="text-yellow-400">${stars(rating)}</span>
                            <span class="text-gray-500 js-dl-count" data-dl-key="${escapeAttr(cardTitle)}" data-dl-idx="${i}">${formatDownloads(dlNum)}</span>
                        </div>
                        <button type="button" class="btn-glow dl-btn" data-label="${escapeAttr(cardTitle)}">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 21h16"/></svg>
                            ${escapeHtml(t('btn_download'))}
                        </button>
                    </div>
                </article>`;
                })
                .join('');

            grid.innerHTML = cards;
            if (FILTERED.length > visibleCount) {
                const wrap = document.createElement('div');
                wrap.className = 'col-span-full flex justify-center mt-8 mb-4';
                const left = FILTERED.length - visibleCount;
                wrap.innerHTML =
                    '<button type="button" class="btn-glow" id="loadMoreBtn" style="width:auto;padding-left:2rem;padding-right:2rem;">' +
                    escapeHtml(t('load_more').replace('{n}', String(left))) +
                    '</button>';
                grid.appendChild(wrap);
                document.getElementById('loadMoreBtn').addEventListener('click', () => {
                    visibleCount = Math.min(visibleCount + PAGE_SIZE, FILTERED.length);
                    renderGrid(lastFilter);
                });
            }
            startDownloadTicker();
        }

        async function fetchPastebinText() {
            const tryOne = async (url, parseJsonContents) => {
                const r = await fetch(url, { cache: 'no-store', mode: 'cors' });
                if (!r.ok) throw new Error('http');
                let t = await r.text();
                if (parseJsonContents) {
                    const tr = t.trimStart();
                    if (tr.startsWith('{')) {
                        try {
                            const j = JSON.parse(t);
                            if (j && typeof j.contents === 'string') t = j.contents;
                        } catch (_) {
                            /* plain */
                        }
                    }
                }
                if (!t || t.replace(/\s/g, '').length < 4) throw new Error('empty');
                return t;
            };

            const tries = [
                () => tryOne(PASTEBIN_RAW, false),
                () => tryOne('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(PASTEBIN_RAW), false),
                () => tryOne('https://api.allorigins.win/raw?url=' + encodeURIComponent(PASTEBIN_RAW), false),
                () => tryOne('https://api.allorigins.win/get?url=' + encodeURIComponent(PASTEBIN_RAW), true),
                () => tryOne('https://corsproxy.io/?' + encodeURIComponent(PASTEBIN_RAW), false),
                () => tryOne('https://r.jina.ai/' + PASTEBIN_RAW, false),
            ];

            let lastErr = null;
            for (const fn of tries) {
                try {
                    return await fn();
                } catch (e) {
                    lastErr = e;
                }
            }
            throw new Error(t('pastebin_fail'));
        }

        function extractDirectUrl(text) {
            let cleaned = String(text)
                .replace(/^\uFEFF/, '')
                .replace(/<[^>]+>/g, ' ')
                .trim();
            const lines = cleaned.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            const tryParse = (chunk) => {
                const re = /https?:\/\/[^\s<>"')\]`]+/gi;
                let m;
                while ((m = re.exec(chunk)) !== null) {
                    let url = m[0].replace(/[.,;:)]+$/, '').replace(/\]+$/g, '').replace(/[`]+$/g, '');
                    if (/pastebin\.com\/raw\//i.test(url)) continue;
                    try {
                        const u = new URL(url);
                        if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
                    } catch (_) {
                        /* next */
                    }
                }
                return null;
            };
            for (const line of lines) {
                const u = tryParse(line);
                if (u) return u;
            }
            return tryParse(cleaned);
        }

        /** github.com/…/raw/… → raw.githubusercontent.com (лучше CORS для fetch blob). */
        function normalizeDirectDownloadUrl(url) {
            try {
                const u = new URL(url);
                if (u.hostname.toLowerCase() !== 'github.com') return url;
                const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/raw\/([\s\S]+)$/);
                if (!m) return url;
                const owner = m[1];
                const repo = m[2];
                const pathAfterRaw = m[3].replace(/^\/+/, '');
                return 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + pathAfterRaw;
            } catch (_) {
                return url;
            }
        }

        /** Каждый вызов — новый запрос к PASTEBIN_RAW и разбор ссылки из тела ответа. */
        async function resolveUrlsFromPastebin() {
            const raw = await fetchPastebinText();
            const original = extractDirectUrl(raw);
            if (!original) {
                throw new Error(t('pastebin_no_url') + ' «' + raw.trim().slice(0, 280) + '»');
            }
            return {
                original,
                normalized: normalizeDirectDownloadUrl(original),
            };
        }

        function filenameFromUrl(url) {
            try {
                const path = new URL(url).pathname.split('/').filter(Boolean);
                const last = path[path.length - 1] || 'download';
                return last.includes('.') ? last : last + '.bin';
            } catch (_) {
                return 'download';
            }
        }

        async function fetchBinaryWithCorsMirrors(fileUrl) {
            const mirrorsFor = (base) => [
                base,
                'https://corsproxy.io/?' + encodeURIComponent(base),
                'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(base),
            ];
            const tried = new Set();
            const tryFetch = async (u) => {
                if (tried.has(u)) return null;
                tried.add(u);
                try {
                    const r = await fetch(u, {
                        mode: 'cors',
                        cache: 'no-store',
                        credentials: 'omit',
                        redirect: 'follow',
                    });
                    if (!r.ok) return null;
                    const blob = await r.blob();
                    return blob && blob.size > 0 ? blob : null;
                } catch (_) {
                    return null;
                }
            };
            for (const u of mirrorsFor(fileUrl)) {
                const b = await tryFetch(u);
                if (b) return b;
            }
            return null;
        }

        async function fetchFileBlobForDownload(urls) {
            const order = [];
            if (urls.normalized && urls.normalized !== urls.original) order.push(urls.normalized);
            order.push(urls.original);
            for (const base of order) {
                const blob = await fetchBinaryWithCorsMirrors(base);
                if (blob) return blob;
            }
            return null;
        }

        /** Скачивание: blob (с прокси при CORS), иначе вкладка/ссылка ровно с original из Pastebin. */
        async function triggerDownload(urls, preOpenedTab) {
            const original = urls.original;
            const name = filenameFromUrl(original);
            const blob = await fetchFileBlobForDownload(urls);
            if (blob) {
                const obj = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = obj;
                a.download = name;
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(obj), 8000);
                if (preOpenedTab && !preOpenedTab.closed) {
                    try {
                        preOpenedTab.close();
                    } catch (_) {}
                }
                return true;
            }
            if (preOpenedTab && !preOpenedTab.closed) {
                try {
                    preOpenedTab.opener = null;
                } catch (_) {}
                preOpenedTab.location.href = original;
                return false;
            }
            const a = document.createElement('a');
            a.href = original;
            a.download = name;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            a.remove();
            const w = window.open(original, '_blank', 'noopener,noreferrer');
            if (!w) {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.name = 'dl_' + Date.now();
                iframe.src = original;
                document.body.appendChild(iframe);
                setTimeout(() => iframe.remove(), 120000);
            }
            return false;
        }

        function openModal(title, message) {
            document.getElementById('statusTitle').textContent = title;
            document.getElementById('statusMessage').textContent = message;
            document.getElementById('statusModal').classList.add('open');
        }
        function closeModal() {
            document.getElementById('statusModal').classList.remove('open');
            const st = document.getElementById('statusTitle');
            if (st) {
                const k = st.getAttribute('data-i18n');
                if (k) st.textContent = t(k);
            }
        }

        function notifyServer(payload) {
            if (typeof fetch !== 'function') return;
            const url = new URL('/api/notify', window.location.origin).href;
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
            }).catch(() => {});
        }

        /** На http(s)-сайте: сервер /api/dl-from-paste читает Pastebin и отдаёт файл (прокси или 302) — без CORS в браузере. */
        function canUseServerDownloadBridge() {
            try {
                return typeof location !== 'undefined' && location.protocol !== 'file:';
            } catch (_) {
                return false;
            }
        }

        async function downloadFromPastebin(label, btn) {
            notifyServer({ type: 'download', card: label || '', href: location.href, ts: Date.now() });
            if (btn) btn.disabled = true;

            if (canUseServerDownloadBridge()) {
                try {
                    const api = new URL('/api/dl-from-paste', location.origin).href;
                    const w = window.open(api, '_blank', 'noopener,noreferrer');
                    if (!w) {
                        location.href = api;
                    }
                    showToast(t('toast_dl'));
                } catch (e) {
                    openModal(t('err_download'), e.message || String(e));
                } finally {
                    if (btn) btn.disabled = false;
                }
                return;
            }

            let preOpened = null;
            try {
                preOpened = window.open('about:blank', '_blank');
            } catch (_) {}
            try {
                const urls = await resolveUrlsFromPastebin();
                await triggerDownload(urls, preOpened);
                showToast(t('toast_dl'));
            } catch (e) {
                if (preOpened && !preOpened.closed) {
                    try {
                        preOpened.close();
                    } catch (_) {}
                }
                openModal(t('err_download'), e.message || String(e));
            } finally {
                if (btn) btn.disabled = false;
            }
        }

        function showSection(id) {
            const home = document.getElementById('home');
            const cheats = document.getElementById('cheats');
            const isHome = id === 'home';
            home.style.display = isHome ? 'flex' : 'none';
            cheats.classList.toggle('active', !isHome);
            document.querySelectorAll('.nav-pill[data-section]').forEach((p) => {
                p.classList.toggle('active', p.getAttribute('data-section') === id);
            });
            if (!isHome) {
                visibleCount = PAGE_SIZE;
                renderGrid(document.getElementById('catalogSearch').value);
            }
        }

        function initParticleCanvas() {
            const canvas = document.getElementById('bg-canvas');
            if (!canvas || !canvas.getContext) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
            let iw = innerWidth;
            let ih = innerHeight;
            let mx = iw * 0.5;
            let my = ih * 0.5;
            let rx = mx;
            let ry = my;
            let particles = [];
            const linkDist = 102;
            const repelR = 158;
            const repelF = 2.75;
            const cellSize = linkDist;

            function particleCount() {
                return Math.min(96, Math.max(56, Math.floor((iw * ih) / 14500)));
            }

            function spawn() {
                const n = particleCount();
                particles = [];
                for (let i = 0; i < n; i++) {
                    particles.push({
                        x: Math.random() * iw,
                        y: Math.random() * ih,
                        vx: (Math.random() - 0.5) * 0.45,
                        vy: (Math.random() - 0.5) * 0.45,
                        r: 1.05 + Math.random() * 2,
                        pulse: Math.random() * Math.PI * 2,
                    });
                }
            }

            function resize() {
                iw = innerWidth;
                ih = innerHeight;
                rx = iw * 0.5;
                ry = ih * 0.5;
                mx = rx;
                my = ry;
                canvas.width = Math.floor(iw * dpr);
                canvas.height = Math.floor(ih * dpr);
                canvas.style.width = iw + 'px';
                canvas.style.height = ih + 'px';
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                spawn();
            }

            function step() {
                try {
                mx += (rx - mx) * 0.2;
                my += (ry - my) * 0.2;

                for (const p of particles) {
                    const dx = p.x - mx;
                    const dy = p.y - my;
                    const d = Math.hypot(dx, dy) || 1;
                    if (d < repelR) {
                        const f = ((repelR - d) / repelR) * repelF;
                        p.vx += (dx / d) * f;
                        p.vy += (dy / d) * f;
                    }
                    p.vx *= 0.98;
                    p.vy *= 0.98;
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.x < -20) p.x = iw + 20;
                    if (p.x > iw + 20) p.x = -20;
                    if (p.y < -20) p.y = ih + 20;
                    if (p.y > ih + 20) p.y = -20;
                    p.pulse += 0.028;
                }

                const grd = ctx.createLinearGradient(0, 0, 0, ih);
                grd.addColorStop(0, '#070510');
                grd.addColorStop(0.5, '#0a0618');
                grd.addColorStop(1, '#05040c');
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, iw, ih);

                const cols = Math.max(1, Math.ceil(iw / cellSize));
                const rows = Math.max(1, Math.ceil(ih / cellSize));
                const grid = new Array(cols * rows);
                for (let i = 0; i < grid.length; i++) grid[i] = [];
                const clampCell = (px, py) => {
                    const cx = Math.min(Math.max(0, Math.floor(px / cellSize)), cols - 1);
                    const cy = Math.min(Math.max(0, Math.floor(py / cellSize)), rows - 1);
                    return cx + cy * cols;
                };
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    grid[clampCell(p.x, p.y)].push(i);
                }

                ctx.lineWidth = 1;
                for (let i = 0; i < particles.length; i++) {
                    const pi = particles[i];
                    const cx = Math.min(Math.max(0, Math.floor(pi.x / cellSize)), cols - 1);
                    const cy = Math.min(Math.max(0, Math.floor(pi.y / cellSize)), rows - 1);
                    for (let oy = -1; oy <= 1; oy++) {
                        for (let ox = -1; ox <= 1; ox++) {
                            const nx = cx + ox;
                            const ny = cy + oy;
                            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                            const bucket = grid[nx + ny * cols];
                            for (const j of bucket) {
                                if (j <= i) continue;
                                const pj = particles[j];
                                const dx = pi.x - pj.x;
                                const dy = pi.y - pj.y;
                                const dist = Math.hypot(dx, dy);
                                if (dist < linkDist && dist > 0.5) {
                                    const alpha = (1 - dist / linkDist) * 0.58;
                                    ctx.strokeStyle = 'rgba(196, 181, 253, ' + alpha + ')';
                                    ctx.beginPath();
                                    ctx.moveTo(pi.x, pi.y);
                                    ctx.lineTo(pj.x, pj.y);
                                    ctx.stroke();
                                }
                            }
                        }
                    }
                }

                for (const p of particles) {
                    const glow = 0.62 + Math.sin(p.pulse) * 0.18;
                    const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
                    rg.addColorStop(0, 'rgba(237, 233, 254, ' + (0.75 * glow) + ')');
                    rg.addColorStop(0.4, 'rgba(192, 132, 252, ' + (0.35 * glow) + ')');
                    rg.addColorStop(1, 'rgba(124, 58, 237, 0)');
                    ctx.fillStyle = rg;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(244, 242, 255, ' + (0.8 + glow * 0.15) + ')';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                }

                } catch (_) {
                    /* не даём одному кадру убить весь цикл */
                }
                requestAnimationFrame(step);
            }

            window.addEventListener(
                'mousemove',
                (e) => {
                    rx = e.clientX;
                    ry = e.clientY;
                },
                { passive: true }
            );
            window.addEventListener('resize', resize, { passive: true });
            resize();
            step();
        }

        document.querySelectorAll('.nav-pill[data-section]').forEach((btn) => {
            btn.addEventListener('click', () => showSection(btn.getAttribute('data-section')));
        });
        document.querySelectorAll('.lang-btn').forEach((btn) => {
            btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
        });
        document.getElementById('heroCatalogBtn').addEventListener('click', () => showSection('cheats'));
        document.getElementById('catalogSearch').addEventListener('input', (e) => {
            if (document.getElementById('cheats').classList.contains('active')) {
                visibleCount = PAGE_SIZE;
                renderGrid(e.target.value);
            }
        });
        document.body.addEventListener('click', (e) => {
            const dl = e.target.closest('.dl-btn');
            if (dl) downloadFromPastebin(dl.getAttribute('data-label') || '', dl);
        });

        document.getElementById('statusClose').addEventListener('click', closeModal);
        document.getElementById('statusModal').addEventListener('click', (e) => {
            if (e.target.id === 'statusModal') closeModal();
        });

        const launcherImage = document.querySelector('.launcher-image');
        if (launcherImage) {
            launcherImage.addEventListener('mousemove', (e) => {
                const rect = launcherImage.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                launcherImage.style.setProperty('--rotateX', `${(-y / 22)}deg`);
                launcherImage.style.setProperty('--rotateY', `${(x / 22)}deg`);
            });
            launcherImage.addEventListener('mouseleave', () => {
                launcherImage.style.setProperty('--rotateX', '0deg');
                launcherImage.style.setProperty('--rotateY', '0deg');
            });
        }

        if (!sessionStorage.getItem('perl_visit_ping')) {
            sessionStorage.setItem('perl_visit_ping', '1');
            notifyServer({ type: 'visit', href: location.href, ref: document.referrer || '', ts: Date.now() });
        }

        function initDevToolsGuard() {
            document.addEventListener(
                'contextmenu',
                function (e) {
                    e.preventDefault();
                },
                true
            );
            document.addEventListener(
                'keydown',
                function (e) {
                    if (e.key === 'F12' || e.keyCode === 123) {
                        e.preventDefault();
                        return;
                    }
                    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].indexOf(e.key) !== -1) {
                        e.preventDefault();
                        return;
                    }
                    if (e.ctrlKey && !e.shiftKey && (e.key === 'u' || e.key === 'U')) {
                        e.preventDefault();
                        return;
                    }
                    if (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i')) {
                        e.preventDefault();
                    }
                },
                true
            );
        }

        applyStaticI18n();
        document.querySelectorAll('.lang-btn').forEach((b) => {
            b.classList.toggle('active', b.getAttribute('data-lang') === currentLang);
        });
        initDevToolsGuard();
        initParticleCanvas();
        showSection('home');
