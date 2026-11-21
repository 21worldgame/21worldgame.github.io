// Depois do git push: espera o GitHub Pages servir TODOS os arquivos do último commit iguais aos daqui
// e então avisa na hora todos os aparelhos conectados (celular e computador) para atualizar.
// Uso: node confere-publicacao.mjs   (sai com erro se em 10 min algum arquivo ainda estiver velho)
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SUPABASE } from './supabase-config.js';

const SITE = 'https://21worldgame.github.io/';
const files = execSync('git show --name-only --diff-filter=d --format= HEAD').toString().split('\n').filter(f => f && !f.startsWith('supabase/'));
const norm = b => b.toString('utf8').replace(/\r\n/g, '\n');
const committed = f => execSync(`git show "HEAD:${f}"`, { maxBuffer: 1 << 26 });   // o que foi publicado, não a pasta (pode ter trabalho em andamento)
const pending = new Set(files);
for (let i = 0; i < 60 && pending.size; i++) {
  for (const f of [...pending]) {
    const r = await fetch(`${SITE}${f}?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok && norm(Buffer.from(await r.arrayBuffer())) === norm(committed(f))) pending.delete(f);
  }
  if (pending.size) { console.log(`esperando ${pending.size}: ${[...pending].join(', ')}`); await new Promise(r => setTimeout(r, 10000)); }
}
if (pending.size) { console.error('AINDA VELHO no site:', [...pending].join(', ')); process.exit(1); }
console.log(`site ok: ${files.length} arquivos iguais`);

const v = JSON.parse(readFileSync('version.json', 'utf8')).v;
const r = await fetch(`${SUPABASE.url}/realtime/v1/api/broadcast`, {
  method: 'POST', headers: { apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ topic: '21w:versao', event: 'v', payload: { v } }] }),
});
console.log(r.ok ? `aviso v${v} enviado para todos os aparelhos conectados` : `aviso falhou (${r.status}); eles pegam sozinhos em até 30 s`);
