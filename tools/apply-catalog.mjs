import fs from 'fs';

const htmlPath = new URL('../index.html', import.meta.url);
const jsPath = new URL('./catalog-script.js', import.meta.url);

let html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const toast = `    <div id="appToast" class="toast" role="status" aria-live="polite"></div>\n\n`;

if (!html.includes('id="appToast"')) {
    html = html.replace('<div id="statusModal"', toast + '<div id="statusModal"');
}

if (!html.includes('games.bundle.js')) {
    html = html.replace(
        /(\s*)<script>\s*\r?\n(\s*)const PASTEBIN_RAW/,
        '$1<script src="games.bundle.js"></script>\n\n$1<script>\n$2const PASTEBIN_RAW'
    );
}

const anchor = html.indexOf('        const PASTEBIN_RAW');
if (anchor === -1) throw new Error('const PASTEBIN_RAW anchor not found');

function findInlineScriptOpen(html, beforeIndex) {
    for (let i = beforeIndex; i >= 0; ) {
        const j = html.lastIndexOf('<script', i);
        if (j < 0) return -1;
        const m = html.slice(j).match(/^<script\b[^>]*>/);
        if (m && !/\ssrc\s*=/.test(m[0])) return j;
        i = j - 1;
    }
    return -1;
}

const open = findInlineScriptOpen(html, anchor);
const close = html.lastIndexOf('    </script>');
if (open === -1 || close === -1 || close < open) throw new Error('inline script bounds');

const before = html.slice(0, open);
const after = html.slice(close + '    </script>'.length);
html = before + '    <script>\n' + js + '\n    </script>' + after;

fs.writeFileSync(htmlPath, html);
console.log('patched', htmlPath.pathname);
