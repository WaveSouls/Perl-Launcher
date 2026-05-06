import fs from 'fs';

const jsonPath = new URL('../games.json', import.meta.url);
const outPath = new URL('../games.bundle.js', import.meta.url);

const raw = fs.readFileSync(jsonPath, 'utf8');
JSON.parse(raw); // validate
fs.writeFileSync(outPath, 'window.__PERL_GAMES__=' + raw + ';');
console.log('written', outPath.pathname, '(' + Math.round(fs.statSync(outPath).size / 1024) + ' KB)');
