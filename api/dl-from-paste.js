/**
 * Сервер читает raw Pastebin (без CORS), вытаскивает первую прямую http(s) ссылку на файл,
 * затем либо отдаёт 302 на неё, либо (если файл небольшой) проксирует тело как attachment.
 * В Vercel: опционально PASTEBIN_RAW (по умолчанию — константа ниже).
 */
const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_PASTE = 'https://pastebin.com/raw/P3ggULWT';
const MAX_PROXY_BYTES = 4 * 1024 * 1024;

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

function normalizeGithubRaw(url) {
    try {
        const u = new URL(url);
        if (u.hostname.toLowerCase() !== 'github.com') return url;
        const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/raw\/([\s\S]+)$/);
        if (!m) return url;
        const pathAfterRaw = m[3].replace(/^\/+/, '');
        return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${pathAfterRaw}`;
    } catch (_) {
        return url;
    }
}

function filenameFromUrl(url) {
    try {
        const path = new URL(url).pathname.split('/').filter(Boolean);
        const last = path[path.length - 1] || 'download';
        return last.includes('.') ? last : `${last}.bin`;
    } catch (_) {
        return 'download';
    }
}

function allowedPasteUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname.toLowerCase() === 'pastebin.com' && u.pathname.toLowerCase().startsWith('/raw/');
    } catch (_) {
        return false;
    }
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).send('Method not allowed');
    }

    const pasteUrl = (process.env.PASTEBIN_RAW || DEFAULT_PASTE).trim();
    if (!allowedPasteUrl(pasteUrl)) {
        return res.status(500).send('PASTEBIN_RAW must be a pastebin.com/raw/… URL');
    }

    try {
        const pr = await fetch(pasteUrl, { headers: { 'User-Agent': UA } });
        if (!pr.ok) {
            return res.status(502).send(`Pastebin HTTP ${pr.status}`);
        }
        const text = await pr.text();
        let fileUrl = extractDirectUrl(text);
        if (!fileUrl) {
            return res.status(400).send(`No direct file URL in paste. Snippet: ${text.slice(0, 200)}`);
        }
        fileUrl = normalizeGithubRaw(fileUrl);
        const fname = filenameFromUrl(fileUrl);

        const forceRedirect = req.query.redirect === '1' || req.query.redirect === 'true';
        if (!forceRedirect) {
            let headLen = -1;
            try {
                const headRes = await fetch(fileUrl, {
                    method: 'HEAD',
                    redirect: 'follow',
                    headers: { 'User-Agent': UA },
                });
                if (headRes.ok) {
                    const n = Number(headRes.headers.get('content-length'));
                    headLen = Number.isFinite(n) && n >= 0 ? n : -1;
                }
            } catch (_) {
                /* redirect */
            }

            if (headLen > MAX_PROXY_BYTES) {
                res.setHeader('Cache-Control', 'no-store');
                return res.redirect(302, fileUrl);
            }

            if (headLen > 0 && headLen <= MAX_PROXY_BYTES) {
                const fr = await fetch(fileUrl, { redirect: 'follow', headers: { 'User-Agent': UA } });
                if (fr.ok) {
                    const buf = Buffer.from(await fr.arrayBuffer());
                    if (buf.length > 0 && buf.length <= MAX_PROXY_BYTES) {
                        res.setHeader('Content-Type', 'application/octet-stream');
                        res.setHeader(
                            'Content-Disposition',
                            `attachment; filename="${fname.replace(/"/g, '')}"`
                        );
                        res.setHeader('Cache-Control', 'no-store');
                        return res.status(200).send(buf);
                    }
                }
            }
        }

        res.setHeader('Cache-Control', 'no-store');
        return res.redirect(302, fileUrl);
    } catch (e) {
        return res.status(500).send(String(e && e.message ? e.message : e));
    }
}
