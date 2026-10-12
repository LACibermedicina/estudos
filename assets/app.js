'use strict';
/* Estudo Claro — SPA em JavaScript puro (sem framework, sem CDN). Todo texto entra via textContent. */
const $ = (s, r = document) => r.querySelector(s);
const el = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [n, v] of Object.entries(a)) {
    if (v == null || v === false) continue;
    if (n === 'class') e.className = v;
    else if (n.startsWith('on')) e.addEventListener(n.slice(2), v);
    else e.setAttribute(n, v === true ? '' : v);
  }
  for (const c of k.flat(9)) e.append(c && c.nodeType ? c : document.createTextNode(c ?? ''));
  return e;
};
const S = { user: null, csrf: '', name: 'Estudo Claro', prefs: { theme: 'claro', fs: 22, lh: 1.7, ls: 0.02, tts: 0, rate: 1 } };
let cleanup = null, uid = 0;
const view = $('#view'), live = $('#live');

/* ---------- rede ---------- */
async function api(r, { body, qs } = {}) {
  const o = { credentials: 'same-origin', headers: { 'X-CSRF': S.csrf } };
  if (body !== undefined) { o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  const res = await fetch('api.php?r=' + r + (qs ? '&' + new URLSearchParams(qs) : ''), o);
  const j = await res.json().catch(() => ({ error: 'Resposta inválida do servidor.' }));
  if (!res.ok) throw Object.assign(new Error(j.error || 'Erro'), { status: res.status });
  return j;
}
const notify = (t) => { live.replaceChildren(t ? el('div', { class: 'msg' }, t) : ''); };

/* ---------- preferências de leitura ---------- */
function applyPrefs() {
  const p = S.prefs, r = document.documentElement;
  r.dataset.theme = p.theme; r.style.setProperty('--fs', p.fs + 'px'); r.style.setProperty('--lh', p.lh); r.style.setProperty('--ls', p.ls + 'em');
  localStorage.setItem('ec', JSON.stringify(p));
}
let saveT;
function setPref(k, v, save = true) {
  S.prefs[k] = v; applyPrefs();
  if (S.user && save) { clearTimeout(saveT); saveT = setTimeout(() => api('prefs', { body: S.prefs }).catch(() => {}), 400); }
}
function say(t) {
  if (!('speechSynthesis' in window) || !t) return;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; u.rate = S.prefs.rate; speechSynthesis.speak(u);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-speak]'); if (!b) return;
  if (b.dataset.speak) { say(b.dataset.speak.startsWith('#') ? $(b.dataset.speak)?.innerText : b.dataset.speak); return; }
  const a = b.dataset.act;
  if (a === 'fs+') setPref('fs', Math.min(48, S.prefs.fs + 2));
  if (a === 'fs-') setPref('fs', Math.max(16, S.prefs.fs - 2));
  if (a === 'theme') setPref('theme', { claro: 'noite', noite: 'azul', azul: 'claro' }[S.prefs.theme] || 'claro');
  if (a === 'read') say($('#view').innerText);
  if (a === 'stop') speechSynthesis.cancel();
});

/* ---------- auxiliares de interface ---------- */
const btn = (label, onclick, cls = '') => el('button', { type: 'button', class: cls, onclick }, label);
const link = (label, href, cls = 'alt') => el('a', { class: 'btn ' + cls, href }, label);
const speak = (label, target) => el('button', { type: 'button', class: 'alt', 'data-speak': target }, label);
function field(label, name, o = {}) {
  const i = 'f' + (++uid), ta = o.tag === 'textarea';
  const inp = el(o.tag || 'input', { id: i, name, type: ta ? null : (o.type || 'text'), required: o.req, autocomplete: o.ac, minlength: o.min, placeholder: o.ph, rows: o.rows, value: ta ? null : o.value, class: o.cls }, ta ? (o.value || '') : []);
  return el('div', { class: 'f' }, el('label', { for: i }, label), inp);
}
function select(label, name, opts, cur) {
  const i = 'f' + (++uid);
  return el('div', { class: 'f' }, el('label', { for: i }, label), el('select', { id: i, name }, opts.map(([v, t]) => el('option', { value: v, selected: String(v) === String(cur) }, t))));
}
function form(children, onsubmit, reset = false) {
  return el('form', {
    onsubmit: async (e) => {
      e.preventDefault(); const f = e.target, b = $('button[type=submit]', f); if (b) b.disabled = true;
      try { await onsubmit(Object.fromEntries(new FormData(f)), f); if (reset) f.reset(); } catch (x) { notify(x.message); }
      if (b) b.disabled = false;
    }
  }, children);
}
const submit = (t, cls = '') => el('button', { type: 'submit', class: cls }, t);
const bar = (pc, label) => { const i = el('i'); i.style.width = pc + '%'; return el('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pc, 'aria-label': label }, i); };   // style via CSSOM (a CSP bloqueia style inline)

/* ---------- ajuste offline: notas pendentes ---------- */
const pend = () => { try { return JSON.parse(localStorage.getItem('ecp') || '[]'); } catch { return []; } };
async function flush() {
  const p = pend(); if (!p.length || !S.user) return;
  try { await api('grades', { body: { grades: p } }); localStorage.removeItem('ecp'); } catch { /* tenta de novo depois */ }
}
function queueGrade(card, grade) { localStorage.setItem('ecp', JSON.stringify([...pend(), { card, grade, ts: Math.floor(Date.now() / 1000) }])); flush(); }
addEventListener('online', flush);

/* ---------- autenticação ---------- */
async function boot() {
  try {
    const b = await api('boot'); S.csrf = b.csrf; S.name = b.name; S.user = b.user;
    if (b.user) { S.prefs = b.user.prefs; localStorage.setItem('ecu', JSON.stringify(b.user)); } else localStorage.removeItem('ecu');
  } catch (e) {
    const u = localStorage.getItem('ecu'); if (u && !e.status) { S.user = JSON.parse(u); S.offline = true; }   // sem rede: usa o último usuário conhecido
    else throw e;
  }
  applyPrefs(); buildNav(); flush();
}
async function enter(fn) { await fn(); notify(''); await boot(); location.hash = '#/'; render(); }

function buildNav() {
  const n = $('#nav'); n.replaceChildren(); hud();
  if (!S.user) return;
  n.append(link('🗺️ Trilha', '#/'), link('🃏 Revisar', '#/revisar/due'), link('📚 Resumos', '#/resumos'), link('🏆 Conquistas', '#/conquistas'), link('📦 Pacotes', '#/pacotes'), link('⚙️ Ajustes', '#/ajustes'));
  if (S.user.role === 'admin') n.append(link('🛠️ Administração', '#/admin/users'));
  n.append(btn('Sair (' + S.user.name + ')', async () => { await api('logout', { body: {} }); localStorage.removeItem('ecu'); await boot(); location.hash = '#/'; render(); }, 'alt'));
}

/* ---------- telas ---------- */
function vHome() {
  const sec = (id, title, ...c) => el('section', { class: 'box', id, 'aria-labelledby': id + '-t' }, el('h2', { id: id + '-t' }, title), c);
  return el('div', {},
    el('h1', {}, S.name),
    el('p', {}, 'Estudo e revisão de Direito Administrativo, feitos para baixa visão: letras grandes, contraste alto, leitura em voz alta e revisões curtas.'),
    el('nav', { 'aria-label': 'Opções de acesso' }, link('Tenho um token', '#/token'), link('Entrar', '#/entrar'), link('Pedir acesso', '#/pedir')),
    sec('token', 'Tenho um token', el('p', {}, 'Digite o token recebido para liberar o seu cadastro.'),
      form([field('Token de acesso', 'token', { req: true, ac: 'off', ph: 'XXXX-XXXX', cls: 'tok' }), field('Seu nome', 'name', { req: true, ac: 'name' }), field('E-mail', 'email', { type: 'email', req: true, ac: 'email' }), field('Crie uma senha (mínimo 8 caracteres)', 'pass', { type: 'password', req: true, min: 8, ac: 'new-password' }), el('p', {}, submit('Cadastrar com token'))],
        (d) => enter(() => api('register', { body: d })))),
    sec('entrar', 'Entrar',
      form([field('E-mail', 'email', { type: 'email', req: true, ac: 'username' }), field('Senha', 'pass', { type: 'password', req: true, ac: 'current-password' }), el('p', {}, submit('Entrar'))],
        (d) => enter(() => api('login', { body: d })))),
    sec('pedir', 'Ainda não tenho acesso', el('details', {}, el('summary', { class: 'btn alt', role: 'button' }, 'Pedir acesso'),
      form([field('Seu nome', 'name', { req: true }), field('E-mail', 'email', { type: 'email', req: true }), field('Mensagem (opcional)', 'msg', { tag: 'textarea', rows: 3 }), el('p', {}, submit('Enviar pedido'))],
        async (d, f) => { await api('request', { body: d }); f.reset(); notify('Pedido enviado. Quando for aprovado, o administrador enviará um token para o seu e-mail.'); }))));
}

async function vDash() {
  const s = await api('stats'); S.user.xp = s.xp; hud(); checkAch(s, true);
  const L = lvInfo(s.xp), open = s.topics.map((t, i) => i === 0 || s.topics[i - 1].stars >= 1), cur = s.topics[Math.max(0, open.lastIndexOf(true))];
  return el('div', {},
    el('section', { class: 'box hero' }, el('h1', {}, ico('👋', 'wave'), ' Olá, ' + S.user.name),
      s.pkg ? el('p', {}, ico(s.pkg.emoji, 'bob'), ' Objetivo: ', el('b', {}, s.pkg.goal)) : '',
      el('p', {}, ico('🏆'), ' Nível ', el('b', {}, L.l + ' · ' + L.name), ' · ', ico('🔥', 'flame'), ' ', el('b', {}, s.streak), ' dias seguidos · ', ico('⭐'), ' ', el('b', {}, s.xp + ' XP')),
      bar(L.pc, 'Progresso para o próximo nível'), el('p', {}, 'Faltam ' + L.next + ' XP para o nível ' + (L.l + 1) + '.'),
      el('div', { class: 'tools' }, cur ? link('▶️ Continuar: ' + cur.title, '#/topico/' + cur.id, 'big') : '', link('🃏 Revisar agora (' + s.due + ')', '#/revisar/due', 'alt big'))),
    weakBox(s), el('h2', {}, ico('🗺️'), ' Sua trilha até a aprovação'), trail(s.topics, s.weak));
}
async function vTopics() {
  const t = await api('topics');
  return el('div', {}, el('h1', {}, 'Conteúdo'), el('p', {}, 'Leia o resumo em blocos curtos e depois teste a memória. Ler e testar juntos fixa mais do que reler.'),
    el('div', { class: 'grid' }, t.map((x) => el('div', { class: 'box' }, el('b', {}, el('a', { href: '#/topico/' + x.id }, x.title)), el('br'), x.law, el('br'), x.n + ' cartões'))));
}

async function vTopic(id) {
  const t = await api('topic', { qs: { id } });
  return el('div', {}, el('h1', {}, ico(t.emoji || '📖', 'wig'), ' ', t.title), el('p', {}, el('b', {}, 'Base: '), t.law),
    t.chunks.map((c, i) => el('section', { class: 'box', 'aria-label': 'Bloco ' + (i + 1) }, el('p', { id: 'b' + i }, c), speak('Ouvir bloco', '#b' + i))),
    t.mnemonic ? el('section', { class: 'box mn' }, el('h2', {}, 'Para lembrar'), el('p', { id: 'mn' }, t.mnemonic), speak('Ouvir', '#mn')) : '',
    el('div', { class: 'tools' }, link('🃏 Testar minha memória neste assunto', '#/revisar/topic/' + id, 'big'), t.nv ? link('📚 Resumo visual', '#/resumo/' + id, 'big') : '', link('Voltar', '#/topicos', 'alt big')));
}

function vStudy(mode, id) {
  const key = 'ecq:' + mode + ':' + (id || 0);
  let Q = [], i = 0, hit = 0, shown = false;
  const qh = el('h2', { class: 'qz', tabindex: -1 }, ''), qt = el('p', { class: 'qz', id: 'q' }), topic = el('p', {}), prog = el('p', { 'aria-live': 'polite' });
  const ans = el('div', { hidden: true, class: 'ans' }, el('h2', {}, 'Resposta'), el('p', { class: 'qz', id: 'a', tabindex: -1 }), speak('Ouvir resposta', '#a'));
  const reveal = btn('Mostrar resposta (Espaço)', () => showAns(), 'big');
  const grades = el('div', { hidden: true }, el('p', {}, el('b', {}, 'Como foi? '), '(teclas 1 a 4)'),
    el('div', { class: 'grades' }, [['1 · Errei', 0, 'g0'], ['2 · Difícil', 1, 'g1'], ['3 · Bom', 2, 'g2'], ['4 · Fácil', 3, 'g3']].map(([t, g, c]) => btn(t, () => grade(g), c))));
  const card = el('section', { class: 'box cardq' }, topic, qh, qt, speak('Ouvir pergunta', '#q'), el('p', {}, 'Tente responder em voz alta ou de cabeça antes de ver a resposta.'), reveal, ans);
  const pb = el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i')), sess = el('div', { hidden: true }, el('div', { class: 'tools' }, link('Sair da revisão', '#/', 'alt'), prog), pb, card, grades);
  const sum = el('h2', { tabindex: -1 }), free = el('div', {}, field('Recordação livre: escreva ou diga em voz alta tudo o que lembra deste bloco. Não é salvo.', 'free', { tag: 'textarea', rows: 4 }), el('p', {}, 'Se puder, faça uma pausa de 2 minutos antes de seguir.'));
  const end = el('section', { class: 'box party', hidden: true }, sum, free, btn('Próximo bloco', () => load(), 'big'), ' ', link('Voltar ao início', '#/', 'alt big'));
  const root = el('div', {}, el('h1', {}, 'Revisão ativa'), sess, end);

  function show() {
    const c = Q[i]; shown = false; sess.hidden = false; end.hidden = true;
    prog.textContent = `Cartão ${i + 1} de ${Q.length}`; pb.firstChild.style.width = (i / Q.length * 100) + '%'; topic.textContent = c.title; qh.textContent = 'Pergunta'; qt.textContent = c.q;
    $('#a', ans).textContent = c.a; ans.hidden = true; grades.hidden = true; reveal.hidden = false; qh.focus();
    if (S.prefs.tts) say(c.q);
  }
  function showAns() { if (shown) return; shown = true; ans.hidden = false; grades.hidden = false; reveal.hidden = true; $('#a', ans).focus(); if (S.prefs.tts) say('Resposta: ' + Q[i].a); }
  function grade(g) { if (!shown) return; queueGrade(Q[i].id, g); gain(g); if (g >= 2) hit++; i++; i < Q.length ? show() : finish(); }
  function finish() {
    sess.hidden = true; end.hidden = false; free.hidden = !Q.length; $('textarea', free) && ($('textarea', free).value = '');
    sum.textContent = Q.length ? `Você acertou ${hit} de ${Q.length}. Antes de seguir, faça a recordação livre.` : 'Não há cartões pendentes agora. Volte mais tarde: o intervalo entre revisões é o que fixa a memória.';
    sum.focus(); if (Q.length) api('stats').then((s) => checkAch(s)).catch(() => {});
  }
  async function load() {
    await flush(); i = 0; hit = 0;
    try { Q = await api('queue', { qs: { mode, id: id || 0 } }); localStorage.setItem(key, JSON.stringify(Q)); }
    catch { Q = JSON.parse(localStorage.getItem(key) || '[]'); if (Q.length) notify('Sem conexão: usando os últimos cartões salvos. Suas notas serão enviadas quando a rede voltar.'); }
    Q.length ? show() : finish();
  }
  const keys = (e) => {
    if (e.target.matches('textarea,input') || sess.hidden) return;
    if (e.key === ' ' && !shown) { e.preventDefault(); showAns(); }
    if (['1', '2', '3', '4'].includes(e.key)) grade(+e.key - 1);
  };
  document.body.classList.add('immersive'); document.addEventListener('keydown', keys); cleanup = () => { document.removeEventListener('keydown', keys); document.body.classList.remove('immersive'); };
  load(); return root;
}

function vSettings() {
  const p = S.prefs;
  const rng = (label, k, min, max, step) => { const i = 'f' + (++uid); return el('div', { class: 'f' }, el('label', { for: i }, label), el('input', { id: i, type: 'range', min, max, step, value: p[k], oninput: (e) => setPref(k, +e.target.value) })); };
  return el('div', {}, el('h1', {}, 'Ajustes de leitura'), el('p', {}, 'As mudanças valem na hora e ficam salvas na sua conta.'),
    el('div', { class: 'box' },
      select('Contraste', 'theme', [['claro', 'Sol: azul-marinho sobre fundo claro e alegre'], ['noite', 'Noite: amarelo sobre preto'], ['azul', 'Mar: branco sobre azul-escuro']], p.theme),
      rng('Tamanho da letra', 'fs', 16, 48, 2), rng('Espaço entre linhas', 'lh', 1.4, 2.4, 0.1), rng('Espaço entre letras', 'ls', 0, 0.2, 0.02), rng('Velocidade da voz', 'rate', 0.6, 1.6, 0.1),
      select('Ler cartões em voz alta automaticamente', 'tts', [[0, 'Não'], [1, 'Sim']], p.tts)));
}
function afterSettings() { const t = $('select[name=theme]'), s = $('select[name=tts]'); t && t.addEventListener('change', () => setPref('theme', t.value)); s && s.addEventListener('change', () => setPref('tts', +s.value)); }

function vSources() {
  const box = (t, items, cls = '') => el('section', { class: 'box ' + cls }, el('h2', {}, t), el('ul', {}, items.map((x) => el('li', {}, x))));
  return el('div', {}, el('h1', {}, 'Fontes de estudo'), el('p', {}, 'Os resumos e cartões são textos de apoio escritos para revisão. Para a prova, confirme sempre na bibliografia e na lei.'),
    box('Material institucional', ['Livro didático de Direito Administrativo (Estácio), na plataforma SIA / SAVA.']),
    box('Bibliografia básica (Biblioteca Virtual)', ['DI PIETRO, Maria Sylvia Zanella. Direito Administrativo. Forense.', 'MEIRELLES, Hely Lopes. Direito Administrativo Brasileiro. Malheiros / JusPodivm.', 'CARVALHO FILHO, José dos Santos. Manual de Direito Administrativo. Atlas.', 'MAZZILLI, Marcelo. Direito Administrativo Descomplicado, ou obra equivalente do acervo.']),
    box('Legislação essencial', ['Constituição Federal de 1988, arts. 37 a 41.', 'Lei 14.133/2021 (licitações e contratos).', 'Lei 9.784/1999 (processo administrativo federal).', 'Lei 8.429/1992, com a Lei 14.230/2021 (improbidade).', 'Lei 8.987/1995 (concessões e permissões).']),
    box('Como estudar aqui', ['Recuperação ativa: responda antes de ver a resposta.', 'Repetição espaçada: cada cartão volta conforme a sua nota.', 'Blocos curtos: 8 cartões, recordação livre e pausa.', 'Intercalação: a revisão mista alterna assuntos.', 'Duas vias: leia e ouça o mesmo conteúdo.'], 'mn'));
}

/* ---------- gamificação ---------- */
const ico = (e, c = '') => el('span', { class: 'ico ' + c, 'aria-hidden': 'true' }, e);
const LV = ['Calouro 🐣', 'Estagiário 📎', 'Bacharel 🎓', 'Advogado ⚖️', 'Procurador 🏛️', 'Ministro 👑'];
const lvInfo = (xp) => { const l = Math.floor(Math.sqrt(xp / 30)) + 1, a = 30 * (l - 1) ** 2, b = 30 * l ** 2; return { l, name: LV[Math.min(l - 1, 5)], pc: Math.round(100 * (xp - a) / (b - a)), next: b - xp }; };
const GX = [2, 6, 10, 12];
const ACH = {
  primeiro: ['👣', 'Primeiros passos', 'Responda o seu primeiro cartão.'], cartoes50: ['🃏', 'Colecionador', '50 cartões respondidos.'], cartoes200: ['🏅', 'Maratonista', '200 cartões respondidos.'],
  seq3: ['🔥', 'Pegando fogo', '3 dias seguidos estudando.'], seq7: ['🌋', 'Imparável', '7 dias seguidos estudando.'], estrela: ['⭐', 'Primeira estrela', 'Ganhe uma estrela em qualquer assunto.'],
  tres: ['🌟', 'Mestre do assunto', '3 estrelas em um assunto.'], mapa: ['🗺️', 'Explorador do mapa', 'Ao menos 1 estrela em todos os assuntos.'], nivel5: ['👑', 'Nível 5', 'Chegue ao nível 5.'], aprovado: ['🎓', 'Aprovação!', '3 estrelas em todos os assuntos do pacote.']
};
function hud() {
  const h = $('#hud'); if (!h) return; h.replaceChildren(); if (!S.user) return;
  const x = S.user.xp || 0, l = lvInfo(x); h.append(ico('⭐'), el('b', {}, x + ' XP'), ' · Nv ' + l.l + ' ' + l.name);
}
function toast(t) { const e = el('div', { class: 'toast', role: 'status' }, t); document.body.append(e); setTimeout(() => e.remove(), 4500); }
function xpPop(t) { const e = el('div', { class: 'xppop', 'aria-hidden': 'true' }, t); document.body.append(e); setTimeout(() => e.remove(), 1000); }
function burst() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const b = el('div', { class: 'burst', 'aria-hidden': 'true' }), E = ['🎉', '✨', '⭐', '🎊', '🌟'];
  for (let k = 0; k < 16; k++) { const s = el('span', {}, E[k % 5]); s.style.left = Math.round(Math.random() * 94) + '%'; s.style.animationDelay = (Math.random() * 0.8).toFixed(2) + 's'; b.append(s); }
  document.body.append(b); setTimeout(() => b.remove(), 3500);
}
function gain(g) {
  const u = S.user, a = lvInfo(u.xp || 0).l; u.xp = (u.xp || 0) + GX[g]; hud(); xpPop('+' + GX[g] + ' XP ✨');
  const n = lvInfo(u.xp); if (n.l > a) { toast('🎉 Você subiu para o nível ' + n.l + ': ' + n.name); burst(); }
}
function checkAch(s, init) {
  const k = 'eca' + S.user.id; let known = null; try { known = JSON.parse(localStorage.getItem(k)); } catch { /* ignora */ }
  if (known === null && init) { localStorage.setItem(k, JSON.stringify(s.ach)); return; }
  const fresh = s.ach.filter((c) => !(known || []).includes(c)); localStorage.setItem(k, JSON.stringify(s.ach));
  if (fresh.length) { toast('🏆 Conquista: ' + fresh.map((c) => ACH[c][0] + ' ' + ACH[c][1]).join(', ')); burst(); }
}

/* ---------- mapa da trilha (estilo mapa de jogo) ---------- */
const NS = 'http://www.w3.org/2000/svg';
const sv = (t, a = {}, ...k) => { const e = document.createElementNS(NS, t); for (const [n, v] of Object.entries(a)) if (v != null) e.setAttribute(n, v); for (const c of k.flat(9)) e.append(c && c.nodeType ? c : document.createTextNode(c ?? '')); return e; };
function wrap(t, n = 17) { const L = []; let c = ''; for (const x of t.split(' ')) { if ((c + ' ' + x).trim().length > n && c) { L.push(c); c = x; } else c = (c + ' ' + x).trim(); } if (c) L.push(c); return L.slice(0, 2).map((x, i, a) => (i === 1 && L.length > 2 ? x + '…' : x)); }
function trail(topics, weak) {
  const step = 150, top = 90, n = topics.length, H = top + step * n + 190;
  const P = topics.map((t, i) => ({ x: Math.round(180 + 100 * Math.sin(i * 1.3)), y: top + i * step })), end = { x: 180, y: top + n * step + 30 };
  const open = topics.map((t, i) => i === 0 || topics[i - 1].stars >= 1), cur = Math.max(0, open.lastIndexOf(true));
  const all2 = topics.every((t) => t.stars >= 2), all3 = topics.every((t) => t.stars >= 3), pts = [...P, end];
  let d = `M${pts[0].x} ${pts[0].y}`; for (let i = 1; i < pts.length; i++) d += ` C${pts[i - 1].x} ${pts[i - 1].y + step / 2} ${pts[i].x} ${pts[i].y - step / 2} ${pts[i].x} ${pts[i].y}`;
  const deco = ['🌳', '🌲', '🌼', '🍄', '🌴'], svg = sv('svg', { viewBox: `0 0 360 ${H}`, class: 'trail', role: 'group', 'aria-label': 'Mapa da trilha de aprendizado' },
    sv('defs', {}, sv('linearGradient', { id: 'sg', x1: 0, y1: 0, x2: 0, y2: 1 }, sv('stop', { offset: 0, 'stop-color': '#bfe9ff' }), sv('stop', { offset: 0.5, 'stop-color': '#e3f7c6' }), sv('stop', { offset: 1, 'stop-color': '#c9f0a8' }))),
    sv('rect', { class: 'sky', width: 360, height: H, rx: 24, fill: 'url(#sg)' }), sv('text', { x: 304, y: 48, class: 'sc sun', 'aria-hidden': 'true' }, '☀️'),
    topics.map((t, i) => [sv('text', { x: P[i].x > 180 ? 40 : 320, y: P[i].y + 20, class: 'sc', 'aria-hidden': 'true' }, deco[i % 5]), i % 2 === 0 ? sv('text', { x: i % 4 === 0 ? 70 : 290, y: P[i].y - 55, class: 'sc cloud', 'aria-hidden': 'true' }, '☁️') : '']),
    sv('path', { d, class: 'road-b' }), sv('path', { d, class: 'road' }), sv('text', { x: P[0].x - 62, y: P[0].y, class: 'sc', 'aria-hidden': 'true' }, '🚩'));
  const node = (p, st, emoji, title, sub, href, label, r = 40, extra = []) => {
    const g = sv('g', { class: 'node ' + st }, sv('circle', { cx: p.x, cy: p.y, r, class: 'nc' }), sv('text', { x: p.x, y: p.y, class: 'ne' }, st === 'lock' ? '🔒' : emoji), extra,
      wrap(title).map((l, k) => sv('text', { x: p.x, y: p.y + r + 40 + k * 19, class: 'lb' }, l)));
    if (sub) g.append(sub);
    if (!href) { g.setAttribute('role', 'img'); g.setAttribute('aria-label', label); return g; }
    const a = sv('a', { href, 'aria-label': label }); a.append(g); return a;
  };
  topics.forEach((t, i) => {
    const p = P[i], st = open[i] ? (t.stars >= 3 ? 'done' : 'open') : 'lock', isW = weak.includes(t.id);
    const stars = sv('g', {}, [0, 1, 2].map((k) => sv('text', { x: p.x - 24 + k * 24, y: p.y + 58, class: 'star ' + (k < t.stars ? 'on' : 'off') }, '★')));
    const ex = [isW ? sv('g', { class: 'wk' }, sv('circle', { cx: p.x + 32, cy: p.y - 32, r: 15 }), sv('text', { x: p.x + 32, y: p.y - 32, class: 'sc', style: 'font-size:17px' }, '🔥')) : '', i === cur ? sv('text', { x: p.x - 54, y: p.y - 20, class: 'sc av', 'aria-hidden': 'true' }, '🧑‍🎓') : ''];
    const label = `Fase ${i + 1}: ${t.title}. ${t.stars} de 3 estrelas. ${st === 'lock' ? 'Bloqueada: ganhe uma estrela na fase anterior.' : isW ? 'Reforço recomendado.' : 'Liberada.'}`;
    svg.append(node(p, st, t.emoji || '📖', t.title + (isW ? ' (reforçar)' : ''), stars, st === 'lock' ? null : '#/topico/' + t.id, label, 40, ex));
  });
  const es = all3 ? 'done' : all2 ? 'open' : 'lock';
  svg.append(node(end, es, all3 ? '🎓' : '🏰', 'Aprovação: prova final', null, all2 ? '#/revisar/exam/0' : null, all2 ? 'Castelo da aprovação: fazer o simulado final.' : 'Castelo da aprovação, bloqueado: ganhe 2 estrelas em todas as fases.', 48, all3 ? [sv('text', { x: end.x - 62, y: end.y - 40, class: 'sc spark' }, '🎆'), sv('text', { x: end.x + 62, y: end.y - 40, class: 'sc spark' }, '🎇')] : []));
  const list = el('details', { class: 'box' }, el('summary', { class: 'btn alt', role: 'button' }, 'Ver a trilha em lista'),
    el('ol', {}, topics.map((t, i) => el('li', {}, open[i] ? el('a', { href: '#/topico/' + t.id }, t.title) : t.title, ' — ' + t.stars + ' de 3 estrelas' + (open[i] ? '' : ' (bloqueada)') + (weak.includes(t.id) ? ' (reforçar)' : ''))),
      el('li', {}, all2 ? el('a', { href: '#/revisar/exam/0' }, 'Prova final (simulado)') : 'Prova final (bloqueada: 2 estrelas em todas as fases)')));
  return el('div', {}, svg, el('p', {}, 'Cada fase dá até 3 estrelas conforme você domina os cartões. 1 estrela libera a fase seguinte; 2 estrelas em todas libera o simulado final.'), list);
}
function weakBox(s) {
  const w = s.weak.map((id) => s.topics.find((t) => t.id === id)).filter(Boolean);
  return el('section', { class: 'box' }, el('h2', {}, ico('🔥', 'flame'), ' Reforço recomendado'),
    w.length ? [el('p', {}, 'Assuntos com mais erros nos seus cartões. Aprofunde com os resumos visuais e depois pratique.'),
      el('div', { class: 'grid' }, w.map((t) => el('div', { class: 'box' }, el('b', {}, ico(t.emoji), ' ', t.title), el('br'), 'Acertos: ' + t.acc + '%', el('div', { class: 'tools' }, link('📚 Resumo visual', '#/resumo/' + t.id, ''), link('🃏 Praticar', '#/revisar/topic/' + t.id, 'alt')))))]
      : el('p', {}, 'Ainda sem pontos fracos. Quando um assunto tiver acertos abaixo de 75%, ele aparece aqui com um resumo visual para aprofundar.'));
}

/* ---------- biblioteca de resumos visuais ---------- */
async function vLibrary() {
  const [s, ts] = await Promise.all([api('stats'), api('topics')]), acc = Object.fromEntries(s.topics.map((t) => [t.id, t.acc]));
  const tile = (t) => el('div', { class: 'box' }, el('b', {}, ico(t.emoji), ' ', el('a', { href: '#/resumo/' + t.id }, t.title)), el('br'), t.nv + (t.nv === 1 ? ' resumo visual' : ' resumos visuais'), acc[t.id] != null ? el('br') : '', acc[t.id] != null ? 'Acertos: ' + acc[t.id] + '%' : '');
  const w = s.weak.map((id) => ts.find((t) => t.id === id)).filter(Boolean);
  return el('div', {}, el('h1', {}, ico('📚', 'bob'), ' Biblioteca de resumos visuais'), el('p', {}, 'Cartões de aprofundamento para estudar um tema com calma. Os assuntos de pior desempenho aparecem primeiro.'),
    w.length ? [el('h2', {}, ico('🔥', 'flame'), ' Recomendados para você'), el('div', { class: 'grid' }, w.map(tile))] : '',
    el('h2', {}, 'Todos os assuntos'), el('div', { class: 'grid' }, ts.map(tile)), el('p', {}, link('📖 Ver textos de apoio por assunto', '#/topicos', 'alt')));
}
async function vDeck(id) {
  const [t, vs] = await Promise.all([api('topic', { qs: { id } }), api('visuals', { qs: { id } })]);
  const root = el('div', {}, el('h1', {}, ico(t.emoji || '📚'), ' ', t.title));
  if (!vs.length) { root.append(el('p', {}, 'Este assunto ainda não tem resumo visual.'), link('📖 Ler o texto de apoio', '#/topico/' + id, 'big')); return root; }
  let i = 0; const stage = el('section', { class: 'box vcard', 'aria-live': 'polite' }), dots = el('p', { 'aria-hidden': 'true', class: 'dots' }), count = el('p', {});
  const prev = btn('◀ Anterior', () => go(i - 1), 'alt big'), next = btn('Próximo ▶', () => go(i + 1), 'big'), last = link('🃏 Praticar este assunto', '#/revisar/topic/' + id, 'big');
  function paint() {
    const v = vs[i];
    stage.replaceChildren(el('div', { class: 'bigico' }, ico(v.emoji, 'wig')), el('h2', { tabindex: -1 }, v.title), el('ul', { class: 'chips' }, v.points.map((p) => el('li', {}, p))),
      v.pitfall ? el('p', { class: 'warn' }, ico('⚠️'), ' ', el('b', {}, 'Cuidado: '), v.pitfall) : '', v.example ? el('p', { class: 'tip' }, ico('💡'), ' ', el('b', {}, 'Exemplo: '), v.example) : '',
      speak('🔊 Ouvir este cartão', [v.title, ...v.points, v.pitfall, v.example].filter(Boolean).join('. ')));
    count.textContent = `Cartão ${i + 1} de ${vs.length}`; dots.textContent = vs.map((_, k) => (k === i ? '●' : '○')).join(' ');
    prev.disabled = i === 0; next.hidden = i === vs.length - 1; last.hidden = i !== vs.length - 1;
  }
  function go(k) { if (k < 0 || k >= vs.length) return; i = k; paint(); $('h2', stage).focus(); }
  const keys = (e) => { if (e.target.matches('input,textarea')) return; if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); };
  document.body.classList.add('immersive'); document.addEventListener('keydown', keys); cleanup = () => { document.removeEventListener('keydown', keys); document.body.classList.remove('immersive'); };
  paint(); root.append(count, stage, dots, el('div', { class: 'tools' }, prev, next, last, link('Voltar aos resumos', '#/resumos', 'alt')));
  return root;
}
async function vAch() {
  const s = await api('stats'), L = lvInfo(s.xp);
  return el('div', {}, el('h1', {}, ico('🏆', 'bob'), ' Conquistas'),
    el('section', { class: 'box hero' }, el('p', {}, ico('⭐'), ' ', el('b', {}, s.xp + ' XP'), ' · Nível ', el('b', {}, L.l + ' · ' + L.name)), bar(L.pc, 'Progresso no nível'), el('p', {}, s.reviews + ' cartões respondidos · ' + s.streak + ' dias seguidos')),
    el('div', { class: 'grid' }, Object.entries(ACH).map(([c, [e, n, d]]) => { const on = s.ach.includes(c); return el('div', { class: 'box badge ' + (on ? 'on' : 'off') }, el('div', { class: 'bigico' }, ico(on ? e : '🔒', on ? 'wig' : '')), el('b', {}, n), el('br'), d, el('br'), el('b', {}, on ? '✅ Conquistada' : 'Ainda bloqueada')); })),
    el('h2', {}, 'Como ganhar XP'), el('p', {}, 'Cada cartão vale pontos pela sua nota: Errei +2, Difícil +6, Bom +10, Fácil +12. As estrelas do mapa vêm do domínio dos cartões de cada assunto.'));
}
async function vPkgs() {
  const s = await api('stats');
  return el('div', {}, el('h1', {}, ico('📦', 'bob'), ' Pacotes de estudo'), el('p', {}, 'Cada pacote tem um objetivo, uma trilha, cartões e resumos visuais. Pacotes novos são instalados pelo administrador.'),
    el('div', { class: 'grid' }, s.pkgs.map((p) => el('div', { class: 'box' }, el('div', { class: 'bigico' }, ico(p.emoji, 'bob')), el('b', {}, p.name), el('br'), 'Objetivo: ' + p.goal,
      el('div', { class: 'tools' }, s.pkg && s.pkg.id === p.id ? el('b', {}, '✅ Pacote ativo') : btn('Usar este pacote', async () => { await api('pkg_set', { body: { id: p.id } }); notify('Pacote alterado.'); location.hash = '#/'; render(); }, ''))))),
    el('p', {}, link('📖 Fontes de estudo', '#/fontes', 'alt')));
}

/* ---------- administração ---------- */
const act = (route, body, then, label, cls = 'alt', ask) => btn(label, async () => {
  if (ask && !confirm(ask)) return;
  try { const r = await api(route, { body }); if (then) then(r); await render(true); } catch (x) { notify(x.message); }
}, cls);
async function vAdmin(tab) {
  const tabs = el('nav', { 'aria-label': 'Administração' }, [['users', 'Usuários'], ['tokens', 'Tokens'], ['requests', 'Pedidos'], ['packages', 'Pacotes'], ['content', 'Conteúdo']].map(([k, t]) => link(t, '#/admin/' + k, tab === k ? 'on' : 'alt')));
  const root = el('div', {}, el('h1', {}, 'Administração'), tabs);
  if (tab === 'packages') {
    const ta = field('Cole o JSON do pacote ou escolha um arquivo', 'json', { tag: 'textarea', rows: 8 });
    const file = el('input', { id: 'pf', type: 'file', accept: '.json,application/json', onchange: async (e) => { const f = e.target.files[0]; if (f) $('textarea', ta).value = await f.text(); } });
    root.append(el('section', { class: 'box' }, el('h2', {}, 'Instalar novo pacote'),
      el('p', {}, 'Um pacote traz o objetivo e a trilha de um estudo: slug, name, emoji, goal e topics (title, law, emoji, summary[], mnemonic, cards [[pergunta, resposta]], visuals [{emoji, title, points[], pitfall, example}]). Veja o modelo em pacotes/direito-administrativo.json.'),
      form([ta, el('div', { class: 'f' }, el('label', { for: 'pf' }, 'Ou envie um arquivo .json'), file), el('p', {}, submit('Instalar pacote'))], async (d) => { await api('a_pkg_import', { body: { json: d.json } }); notify('Pacote instalado.'); await render(true); })));
    for (const p of await api('a_pkgs')) root.append(el('div', { class: 'row' }, el('div', {}, ico(p.emoji), ' ', el('b', {}, p.name), el('br'), p.goal, el('br'), p.topics + ' assuntos · ' + p.slug), act('a_pkg_del', { id: p.id }, null, 'Excluir', 'alt', 'Excluir o pacote ' + p.name + ' com assuntos, cartões e progresso?')));
    return root;
  }
  if (tab === 'users') {
    for (const u of await api('a_users')) {
      const mine = u.id === S.user.id;
      root.append(el('div', { class: 'row' }, el('div', {}, el('b', {}, u.name), el('br'), u.email, el('br'), u.role + ' · ' + u.status),
        el('div', { class: 'tools' }, mine ? '' : [act('a_user', { id: u.id, act: 'toggle' }, null, u.status === 'ativo' ? 'Bloquear' : 'Ativar'), act('a_user', { id: u.id, act: 'del' }, null, 'Excluir', 'alt', 'Excluir ' + u.name + ' e todo o progresso?')]),
        form([field('Nova senha', 'pass', { type: 'password', min: 8, ac: 'new-password' }), submit('Redefinir', 'alt')], async (d, f) => { await api('a_user', { body: { id: u.id, act: 'pwd', pass: d.pass } }); f.reset(); notify('Senha redefinida.'); })));
    }
  } else if (tab === 'tokens') {
    root.append(el('section', { class: 'box' }, el('h2', {}, 'Gerar tokens'),
      form([field('Quantidade', 'n', { type: 'number', value: 1 }), select('Perfil', 'role', [['aluno', 'Aluno'], ['admin', 'Administrador']], 'aluno'), field('Validade em dias (0 = sem prazo)', 'days', { type: 'number', value: 7 }), el('p', {}, submit('Gerar'))],
        async (d) => { await api('a_token', { body: { act: 'gen', ...d } }); notify('Tokens gerados.'); await render(true); })));
    for (const t of await api('a_tokens')) {
      const st = t.used_by ? 'usado' : (t.expires && t.expires < Date.now() / 1000 ? 'vencido' : 'disponível');
      root.append(el('div', { class: 'row' }, el('div', {}, el('span', { class: 'tok' }, t.token), ' · ' + t.role + ' · ' + st), t.used_by ? '' : act('a_token', { act: 'del', id: t.id }, null, 'Excluir')));
    }
  } else if (tab === 'requests') {
    const l = await api('a_reqs'); if (!l.length) root.append(el('p', {}, 'Nenhum pedido de acesso.'));
    for (const r of l) root.append(el('div', { class: 'row' }, el('div', {}, el('b', {}, r.name), el('br'), r.email, r.msg ? el('br') : '', r.msg, el('br'), 'Situação: ' + r.status, r.token ? [' · token ', el('span', { class: 'tok' }, r.token)] : ''),
      el('div', { class: 'tools' }, r.status === 'pendente' ? [act('a_req', { id: r.id, act: 'approve' }, (x) => notify('Aprovado. Envie o token ' + x.token + ' ao solicitante.'), 'Aprovar', ''), act('a_req', { id: r.id, act: 'refuse' }, null, 'Recusar')] : '', act('a_req', { id: r.id, act: 'del' }, null, 'Apagar'))));
  } else {
    root.append(el('details', { class: 'box' }, el('summary', { class: 'btn' }, 'Novo assunto'), topicForm({ id: 0, title: '', law: '', summary: '', mnemonic: '' })));
    for (const t of await api('a_content')) {
      root.append(el('details', { class: 'box' }, el('summary', { class: 'btn alt' }, t.title), topicForm(t),
        act('a_topic', { act: 'del', id: t.id }, null, 'Excluir assunto e cartões', 'alt', 'Excluir este assunto e todos os cartões?'),
        el('h2', {}, 'Cartões (' + t.cards.length + ')'),
        t.cards.map((c) => el('div', { class: 'row' }, el('div', {}, el('b', {}, c.q), el('br'), c.a), act('a_card', { act: 'del', id: c.id }, null, 'Excluir'))),
        form([field('Nova pergunta', 'q', { req: true }), field('Resposta', 'a', { req: true }), el('p', {}, submit('Adicionar cartão'))], async (d) => { await api('a_card', { body: { topic_id: t.id, ...d } }); await render(true); })));
    }
  }
  return root;
}
const topicForm = (t) => form([field('Título', 'title', { req: true, value: t.title }), field('Base legal ou bibliográfica', 'law', { value: t.law }), field('Resumo (um bloco curto por linha)', 'summary', { tag: 'textarea', rows: 6, value: t.summary }), field('Mnemônico', 'mnemonic', { value: t.mnemonic }), el('p', {}, submit('Salvar assunto'))],
  async (d) => { await api('a_topic', { body: { id: t.id, ...d } }); notify('Assunto salvo.'); await render(true); });

/* ---------- roteador ---------- */
async function render(keep) {
  cleanup && cleanup(); cleanup = null; if (!keep) notify('');
  const [r, a, b] = location.hash.replace(/^#\/?/, '').split('/');
  let node, title = S.name;
  try {
    if (!S.user) { node = vHome(); }
    else if (r === 'topicos') { node = await vTopics(); title = 'Conteúdo'; }
    else if (r === 'resumos') { node = await vLibrary(); title = 'Resumos visuais'; }
    else if (r === 'resumo') { node = await vDeck(+a); title = 'Resumo visual'; }
    else if (r === 'conquistas') { node = await vAch(); title = 'Conquistas'; }
    else if (r === 'pacotes') { node = await vPkgs(); title = 'Pacotes'; }
    else if (r === 'topico') { node = await vTopic(+a); title = 'Assunto'; }
    else if (r === 'revisar') { node = vStudy(a || 'due', +b || 0); title = 'Revisão'; }
    else if (r === 'ajustes') { node = vSettings(); title = 'Ajustes'; }
    else if (r === 'fontes') { node = vSources(); title = 'Fontes'; }
    else if (r === 'admin' && S.user.role === 'admin') { node = await vAdmin(a || 'users'); title = 'Administração'; }
    else { node = await vDash(); title = 'Início'; }
  } catch (e) {
    if (e.status === 401) { S.user = null; buildNav(); node = vHome(); }
    else node = el('div', {}, el('h1', {}, 'Não foi possível carregar'), el('p', {}, S.offline || !navigator.onLine ? 'Você está sem conexão. Revisões já abertas continuam funcionando.' : e.message), btn('Tentar de novo', () => render(), 'big'));
  }
  const y = scrollY; view.replaceChildren(node); document.title = title + ' · ' + S.name;
  if (keep) scrollTo(0, y);
  else { const h = $('h1', view); if (h) { h.tabIndex = -1; h.focus(); } scrollTo(0, 0); }
  if (!S.user && ['token', 'entrar', 'pedir'].includes(r)) { const s = $('#' + r); s && s.scrollIntoView(); const f = $('input', s); f && f.focus(); }
  if (r === 'ajustes') afterSettings();
}
addEventListener('hashchange', () => render());

/* ---------- início ---------- */
(async () => {
  try { await boot(); } catch (e) { view.replaceChildren(el('h1', {}, 'Sem conexão'), el('p', {}, 'Não foi possível falar com o servidor. Verifique a internet e tente de novo.'), btn('Tentar de novo', () => location.reload(), 'big')); return; }
  await render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
