/**
 * Vercel Serverless → Telegram.
 * В Vercel: Settings → Environment Variables:
 *   TELEGRAM_BOT_TOKEN — токен от @BotFather
 *   TELEGRAM_CHAT_ID   — id чата / канала (число, для супергрупп часто -100…)
 */
function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        cors(res);
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        cors(res);
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    cors(res);

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body || '{}');
        } catch {
            body = {};
        }
    }
    if (!body || typeof body !== 'object') body = {};

    const type = body.type === 'download' ? 'download' : 'visit';
    const card = typeof body.card === 'string' ? body.card : '';
    const href = typeof body.href === 'string' ? body.href : '';
    const ref = typeof body.ref === 'string' ? body.ref : '';

    const ua = req.headers['user-agent'] || '';
    const fwd = req.headers['x-forwarded-for'];
    const ip = typeof fwd === 'string' ? fwd.split(',')[0].trim() : '';

    const lines = [];
    if (type === 'visit') {
        lines.push('👀 Заход на сайт');
    } else {
        lines.push('⬇️ Нажатие «Скачать»');
        if (card) lines.push('Карточка: ' + card);
    }
    if (href) lines.push('Страница: ' + href);
    if (ip) lines.push('IP: ' + ip);
    if (ref) lines.push('Referrer: ' + ref.slice(0, 220));
    if (ua) lines.push('UA: ' + String(ua).slice(0, 200));

    const text = lines.join('\n');

    if (!token || !chatId) {
        return res.status(200).json({
            ok: true,
            skipped: true,
            reason: 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel env',
        });
    }

    const tgRes = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true,
        }),
    });

    if (!tgRes.ok) {
        const errText = await tgRes.text();
        return res.status(500).json({ ok: false, error: errText });
    }

    return res.status(200).json({ ok: true });
}
