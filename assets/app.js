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
  if (a === 'auto') { autoRead = !autoRead; localStorage.setItem('ecr', autoRead ? '1' : '0'); b.setAttribute('aria-pressed', String(autoRead)); say(autoRead ? 'Leitura ao focar ligada.' : 'Leitura ao focar desligada.'); }
});

/* Links internos (#/...) tratados aqui: sem recarregar a página e sem abrir o app dentro de si mesmo quando embutido em moldura/iframe. */
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey) return;
  const h = a.getAttribute('href'); e.preventDefault();
  if (h.startsWith('#/')) { if (location.hash === h) render(); else location.hash = h; }
  else { const t = document.getElementById(h.slice(1)); if (t) { t.focus(); t.scrollIntoView(); } }
});
/* Ler ao focar: fala o texto do item que recebe o foco (teclado ou toque) */
let autoRead = localStorage.getItem('ecr') === '1';
document.querySelector('[data-act=auto]')?.setAttribute('aria-pressed', String(autoRead));
document.addEventListener('focusin', (e) => { if (!autoRead) return; const t = e.target; if (!t.matches || t.matches('input,textarea,select')) return; const x = t.getAttribute('aria-label') || t.innerText; if (x) say(x.trim().slice(0, 300)); });

const ED = () => (document.body.classList.contains('portal') ? 'portal' : document.body.classList.contains('acc') ? 'acessivel' : '');
function choose(ed) {
  try { localStorage.setItem('ec_ed', ed); document.cookie = 'ed=' + ed + ';max-age=31536000;path=' + location.pathname.replace(/[^/]*$/, '') + ';samesite=lax'; } catch { /* sem armazenamento */ }
  if (window.PREVIEW) { document.body.classList.remove('portal', 'acc'); document.body.classList.add(ed === 'portal' ? 'portal' : 'acc'); buildNav(); location.hash = '#/'; render(); }
  else location.href = ed === 'portal' ? 'portal.php' : 'acessivel.php';
}
const LOGO = window.LOGO_SRC || 'assets/mark.svg';
const toolsOn = () => { const v = localStorage.getItem('ec_tools'); return v === null ? ED() !== 'portal' : v === '1'; };
function applyTools() {
  const on = toolsOn(); document.body.classList.toggle('tools-off', !on); const t = $('#a11ytoggle');
  if (t) { t.setAttribute('aria-expanded', String(on)); t.textContent = on ? '♿ Ocultar acessibilidade' : '♿ Acessibilidade'; }
}
$('#a11ytoggle')?.addEventListener('click', () => { localStorage.setItem('ec_tools', toolsOn() ? '0' : '1'); applyTools(); });
document.addEventListener('pointerdown', (e) => {   // ondinha de toque nos botões
  const b = e.target.closest && e.target.closest('button,.btn'); if (!b || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = b.getBoundingClientRect(), s = el('span', { class: 'rip', 'aria-hidden': 'true' }); s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px'; b.append(s); setTimeout(() => s.remove(), 650);
});
async function logout() { await api('logout', { body: {} }); localStorage.removeItem('ecu'); await boot(); location.hash = '#/'; render(); }
const b64file = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
document.getElementById('search')?.addEventListener('submit', (e) => { e.preventDefault(); location.hash = '#/explorar?q=' + encodeURIComponent($('#q').value); });

/* ---------- auxiliares de interface ---------- */
const btn = (label, onclick, cls = '') => el('button', { type: 'button', class: cls, onclick }, label);
const link = (label, href, cls = 'alt') => el('a', { class: 'btn ' + cls, href }, label);
const speak = (label, target) => el('button', { type: 'button', class: 'alt', 'data-speak': target }, label);
const ouvir = (t, who = '') => el('button', { type: 'button', class: 'alt ouvir', 'data-speak': t, 'aria-label': 'Ouvir ' + (who || t.slice(0, 50)) }, '🔊');
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
    const b = await api('boot'); S.csrf = b.csrf; S.name = b.name; S.user = b.user; S.editions = b.editions;
    if (b.user) { S.prefs = b.user.prefs; localStorage.setItem('ecu', JSON.stringify(b.user)); } else localStorage.removeItem('ecu');
  } catch (e) {
    const u = localStorage.getItem('ecu'); if (u && !e.status) { S.user = JSON.parse(u); S.offline = true; }   // sem rede: usa o último usuário conhecido
    else throw e;
  }
  applyPrefs(); buildNav(); flush();
}
async function enter(fn) { await fn(); notify(''); await boot(); location.hash = '#/'; render(); }

function buildNav() {
  const n = $('#nav'); n.replaceChildren(); hud(); applyTools();
  if (!S.user || !ED()) return;
  const it = (e, t, h) => el('a', { class: 'btn alt', href: h }, el('span', { class: 'ni', 'aria-hidden': 'true' }, e), el('span', { class: 'nl' }, t));
  if (ED() === 'acessivel') { n.append(it('🗺️', 'Trilha', '#/'), it('🃏', 'Revisar', '#/revisar/due'), it('📚', 'Resumos', '#/resumos'), it('🧭', 'Trilhas', '#/trilhas'), it('☰', 'Mais', '#/mais')); return; }
  n.append(it('🏠', 'Início', '#/'), it('🧭', 'Explorar', '#/explorar'), it('🃏', 'Revisar', '#/revisar/due'), it('🗺️', 'Minhas trilhas', '#/trilhas'), it('👥', 'Grupos', '#/grupos'), it('🗂️', 'Materiais', '#/materiais'), it('📚', 'Resumos', '#/resumos'), it('🏆', 'Conquistas', '#/conquistas'), it('⚙️', 'Ajustes', '#/ajustes'));
  if (S.user.role === 'admin') n.append(it('🛠️', 'Administração', '#/admin/users'));
  n.append(it('🔀', 'Trocar de versão', '#/versao'), el('button', { type: 'button', class: 'alt', onclick: logout }, el('span', { class: 'ni', 'aria-hidden': 'true' }, '🚪'), el('span', { class: 'nl' }, 'Sair (' + S.user.name + ')')));
}

/* ---------- telas ---------- */
function vHome() {
  const sec = (id, title, ...c) => el('section', { class: 'box', id, 'aria-labelledby': id + '-t' }, el('h2', { id: id + '-t' }, title), c);
  return el('div', {},
    el('div', { class: 'hero-logo' }, el('img', { class: 'logo-big', src: LOGO, alt: '' })), el('h1', {}, S.name),
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
    s.plan && s.plan.status !== 'ativa' ? el('div', { class: 'msg' }, '⏸️ Esta trilha está desativada: você pode ver o mapa e o conteúdo, mas não estudar até reativar. O tempo e as metas estão congelados.') : '',
    el('section', { class: 'box hero' }, el('h1', {}, ico('👋', 'wave'), ' Olá, ' + S.user.name),
      s.pkg ? el('p', {}, ico(s.pkg.emoji, 'bob'), ' Objetivo: ', el('b', {}, s.pkg.goal)) : '',
      el('p', {}, ico('🏆'), ' Nível ', el('b', {}, L.l + ' · ' + L.name), ' · ', ico('🔥', 'flame'), ' ', el('b', {}, s.streak), ' dias seguidos · ', ico('⭐'), ' ', el('b', {}, s.xp + ' XP')),
      bar(L.pc, 'Progresso para o próximo nível'), el('p', {}, 'Faltam ' + L.next + ' XP para o nível ' + (L.l + 1) + '. ', ouvir('Nível ' + L.l + ', ' + L.name + '. ' + s.xp + ' pontos. Faltam ' + L.next + ' pontos para o próximo nível. ' + s.streak + ' dias seguidos.')),
      el('div', { class: 'tools' }, cur ? link('▶️ Continuar: ' + cur.title, '#/topico/' + cur.id, 'big') : '', link('🃏 Revisar agora (' + s.due + ')', '#/revisar/due', 'alt big'), btn('📍 Onde parei', () => { const c = $('.node.cur'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 'alt big'), s.pkg ? link('📊 Painel e metas', '#/trilha/' + s.pkg.id, 'alt big') : '')),
    el('h2', {}, ico('🗺️'), ' Sua trilha até a aprovação'), trail(s.topics, s.weak, !!(s.plan && s.plan.status !== 'ativa')), weakBox(s), (ED() === 'portal' ? await communityStrip() : ''));
}
async function vTopics() {
  const t = await api('topics');
  return el('div', {}, el('h1', {}, 'Conteúdo'), el('p', {}, 'Leia o resumo em blocos curtos e depois teste a memória. Ler e testar juntos fixa mais do que reler.'),
    el('div', { class: 'grid' }, t.map((x) => el('div', { class: 'box' }, el('b', {}, el('a', { href: '#/topico/' + x.id }, x.title)), el('br'), x.law, el('br'), x.n + ' cartões', el('div', {}, ouvir(x.title + '. ' + x.law))))));
}

async function vTopic(id) {
  const t = await api('topic', { qs: { id } });
  return el('div', {}, el('h1', {}, ico(t.emoji || '📖', 'wig'), ' ', t.title), el('p', {}, el('b', {}, 'Base: '), t.law),
    t.chunks.map((c, i) => el('section', { class: 'box', 'aria-label': 'Bloco ' + (i + 1) }, el('p', { id: 'b' + i }, c), speak('Ouvir bloco', '#b' + i))),
    t.mnemonic ? el('section', { class: 'box mn' }, el('h2', {}, 'Para lembrar'), el('p', { id: 'mn' }, t.mnemonic), speak('Ouvir', '#mn')) : '',
    el('div', { class: 'tools' }, link('🃏 Testar minha memória neste assunto', '#/revisar/topic/' + id, 'big'), t.nv ? link('📚 Resumo visual', '#/resumo/' + id, 'big') : '', t.can_edit ? btn('✨ Gerar mais cartões (IA)', () => expandTopic(id).catch((e) => notify(e.message)), 'alt big') : '', link('Voltar', '#/topicos', 'alt big')));
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
    catch (e) { Q = e.status === 423 ? [] : JSON.parse(localStorage.getItem(key) || '[]'); if (e.status === 423) notify(e.message); else if (Q.length) notify('Sem conexão: usando os últimos cartões salvos. Suas notas serão enviadas quando a rede voltar.'); }
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
  const box = (t, items, cls = '') => el('section', { class: 'box ' + cls }, el('h2', {}, t), el('ul', {}, items.map((x) => el('li', {}, x, ' ', ouvir(x)))));
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
function trail(topics, weak, paused = false) {
  const step = 150, top = 90, n = topics.length, H = top + step * n + 190;
  const P = topics.map((t, i) => ({ x: Math.round(180 + 100 * Math.sin(i * 1.3)), y: top + i * step })), end = { x: 180, y: top + n * step + 30 };
  const open = topics.map((t, i) => i === 0 || topics[i - 1].stars >= 1), cur = Math.max(0, open.lastIndexOf(true));
  const all2 = topics.every((t) => t.stars >= 2), all3 = topics.every((t) => t.stars >= 3), pts = [...P, end];
  const seg = (i) => `C${pts[i - 1].x} ${pts[i - 1].y + step / 2} ${pts[i].x} ${pts[i].y - step / 2} ${pts[i].x} ${pts[i].y}`;
  let d = `M${pts[0].x} ${pts[0].y}`, dd = d; for (let i = 1; i < pts.length; i++) { d += ' ' + seg(i); if (i <= cur) dd += ' ' + seg(i); }
  const deco = ['🌳', '🌲', '🌼', '🍄', '🌴'], wrapEl = el('div', { class: 'trailwrap' }), tip = el('div', { class: 'tip', role: 'status', hidden: true });
  const av = sv('g', { class: 'avatar', 'aria-hidden': 'true', transform: `translate(${P[cur].x} ${P[cur].y})` }, sv('text', { x: -50, y: -22, class: 'sc av' }, '🧑‍🎓'));
  const svg = sv('svg', { viewBox: `0 0 360 ${H}`, class: 'trail' + (paused ? ' paused' : ''), role: 'group', 'aria-label': 'Mapa da trilha de aprendizado' },
    sv('defs', {}, sv('linearGradient', { id: 'sg', x1: 0, y1: 0, x2: 0, y2: 1 }, sv('stop', { offset: 0, 'stop-color': '#bfe9ff' }), sv('stop', { offset: 0.5, 'stop-color': '#e3f7c6' }), sv('stop', { offset: 1, 'stop-color': '#c9f0a8' }))),
    sv('rect', { class: 'sky', width: 360, height: H, rx: 24, fill: 'url(#sg)' }), sv('text', { x: 304, y: 48, class: 'sc sun', 'aria-hidden': 'true' }, '☀️'),
    topics.map((t, i) => [sv('text', { x: P[i].x > 180 ? 40 : 320, y: P[i].y + 20, class: 'sc', 'aria-hidden': 'true' }, deco[i % 5]), i % 2 === 0 ? sv('text', { x: i % 4 === 0 ? 70 : 290, y: P[i].y - 55, class: 'sc cloud', 'aria-hidden': 'true' }, '☁️') : '']),
    sv('path', { d, class: 'road-b' }), sv('path', { d, class: 'road' }), sv('path', { d: dd, class: 'road-done', pathLength: 1 }), sv('text', { x: P[0].x - 62, y: P[0].y, class: 'sc', 'aria-hidden': 'true' }, '🚩'));
  const showTip = (txt, x, y) => { tip.hidden = false; tip.textContent = txt; tip.style.left = (x / 360 * 100) + '%'; tip.style.top = (y / H * 100) + '%'; };
  const node = (p, st, emoji, title, sub, href, label, tipText, lockMsg, r = 40, extra = [], isCur = false) => {
    const g = sv('g', { class: 'node ' + st + (isCur ? ' cur' : '') }, sv('circle', { cx: p.x, cy: p.y, r, class: 'nc' }), sv('text', { x: p.x, y: p.y, class: 'ne' }, st === 'lock' ? '🔒' : emoji), extra,
      wrap(title).map((l, k) => sv('text', { x: p.x, y: p.y + r + 40 + k * 19, class: 'lb' }, l)));
    if (sub) g.append(sub);
    const outer = href ? sv('a', { href, 'aria-label': label, class: 'nodeg' }) : sv('g', { role: 'button', tabindex: 0, 'aria-label': label, class: 'nodeg lockg' }); outer.append(g);
    const on = () => showTip(tipText, p.x, p.y), off = () => { tip.hidden = true; };
    outer.addEventListener('mouseenter', on); outer.addEventListener('focusin', on); outer.addEventListener('mouseleave', off); outer.addEventListener('focusout', off);
    if (!href) { const act = () => { g.classList.remove('shake'); void g.getBoundingClientRect(); g.classList.add('shake'); toast(lockMsg); }; outer.addEventListener('click', act); outer.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); }
    return outer;
  };
  topics.forEach((t, i) => {
    const p = P[i], st = open[i] ? (t.stars >= 3 ? 'done' : 'open') : 'lock', isW = weak.includes(t.id), isCur = i === cur;
    const stars = sv('g', {}, [0, 1, 2].map((k) => sv('text', { x: p.x - 24 + k * 24, y: p.y + 58, class: 'star ' + (k < t.stars ? 'on' : 'off') }, '★')));
    const ex = [isW ? sv('g', { class: 'wk' }, sv('circle', { cx: p.x + 32, cy: p.y - 32, r: 15 }), sv('text', { x: p.x + 32, y: p.y - 32, class: 'sc', style: 'font-size:17px' }, '🔥')) : ''];
    const label = `Fase ${i + 1}: ${t.title}. ${t.stars} de 3 estrelas. ${st === 'lock' ? 'Bloqueada: ganhe uma estrela na fase anterior.' : isW ? 'Reforço recomendado.' : 'Liberada.'}`;
    const tipText = `Fase ${i + 1}: ${t.title} · ${'★'.repeat(t.stars)}${'☆'.repeat(3 - t.stars)} · ${st === 'lock' ? 'bloqueada' : isCur ? 'você está aqui' : 'liberada'}`;
    const href = st === 'lock' || paused ? null : '#/topico/' + t.id, lockMsg = paused ? '⏸️ Trilha desativada: reative para estudar.' : '🔒 Ganhe 1 estrela em «' + (topics[i - 1] ? topics[i - 1].title : '') + '» para liberar esta fase.';
    svg.append(node(p, st, t.emoji || '📖', t.title + (isW ? ' (reforçar)' : ''), stars, href, label, tipText, lockMsg, 40, ex, isCur));
  });
  const es = all3 ? 'done' : all2 ? 'open' : 'lock', castleOpen = all2 && !paused;
  svg.append(node(end, es, all3 ? '🎓' : '🏰', 'Aprovação: prova final', null, castleOpen ? '#/revisar/exam/0' : null, all2 ? 'Castelo da aprovação: fazer o simulado final.' : 'Castelo da aprovação, bloqueado: ganhe 2 estrelas em todas as fases.', 'Castelo da aprovação' + (all2 ? ': simulado final' : ' · bloqueado'),
    paused ? '⏸️ Trilha desativada: reative para estudar.' : '🔒 Ganhe 2 estrelas em todas as fases para liberar a prova final.', 48, all3 ? [sv('text', { x: end.x - 62, y: end.y - 40, class: 'sc spark' }, '🎆'), sv('text', { x: end.x + 62, y: end.y - 40, class: 'sc spark' }, '🎇')] : []));
  svg.append(av);
  /* o personagem caminha pelo caminho até a fase atual */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, setAv = (x, y) => av.setAttribute('transform', `translate(${x} ${y})`);
  if (!reduce && cur > 0) {
    setAv(P[0].x, P[0].y); const dur = Math.min(3600, 700 + cur * 450); let t0 = null, tries = 0;
    const bez = (a, b, c, e, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e; };
    const frame = (ts) => {
      if (!svg.isConnected) { if (tries++ < 60) requestAnimationFrame(frame); else setAv(P[cur].x, P[cur].y); return; }
      if (t0 === null) t0 = ts; const p = Math.min(1, (ts - t0) / dur), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, f = e * cur, i = Math.min(cur, Math.floor(f) + 1), t = Math.max(0, Math.min(1, f - (i - 1)));
      setAv(bez(pts[i - 1].x, pts[i - 1].x, pts[i].x, pts[i].x, t), bez(pts[i - 1].y, pts[i - 1].y + step / 2, pts[i].y - step / 2, pts[i].y, t));
      if (p < 1) requestAnimationFrame(frame); else setAv(P[cur].x, P[cur].y);
    };
    requestAnimationFrame(frame); setTimeout(() => setAv(P[cur].x, P[cur].y), dur + 6000);
  }
  wrapEl.append(svg, tip);
  const legend = el('p', { class: 'legend' }, '🧑‍🎓 você está aqui · 🔒 bloqueada · ★ estrelas · 🔥 reforçar · toque ou passe o mouse numa fase para ver os detalhes.');
  const list = el('details', { class: 'box' }, el('summary', { class: 'btn alt', role: 'button' }, 'Ver a trilha em lista'),
    el('ol', {}, topics.map((t, i) => el('li', {}, open[i] ? el('a', { href: '#/topico/' + t.id }, t.title) : t.title, ' — ' + t.stars + ' de 3 estrelas' + (open[i] ? '' : ' (bloqueada)') + (weak.includes(t.id) ? ' (reforçar)' : ''), ' ', ouvir('Fase ' + (i + 1) + ': ' + t.title + '. ' + t.stars + ' de 3 estrelas.' + (open[i] ? '' : ' Bloqueada.')))),
      el('li', {}, all2 ? el('a', { href: '#/revisar/exam/0' }, 'Prova final (simulado)') : 'Prova final (bloqueada: 2 estrelas em todas as fases)')));
  return el('div', {}, wrapEl, legend, el('p', {}, 'Cada fase dá até 3 estrelas conforme você domina os cartões. 1 estrela libera a fase seguinte; 2 estrelas em todas libera o simulado final.'), list);
}
function weakBox(s) {
  const w = s.weak.map((id) => s.topics.find((t) => t.id === id)).filter(Boolean);
  return el('section', { class: 'box' }, el('h2', {}, ico('🔥', 'flame'), ' Reforço recomendado'),
    w.length ? [el('p', {}, 'Assuntos com mais erros nos seus cartões. Aprofunde com os resumos visuais e depois pratique.'),
      el('div', { class: 'grid' }, w.map((t) => el('div', { class: 'box' }, el('b', {}, ico(t.emoji), ' ', t.title), el('br'), 'Acertos: ' + t.acc + '%', el('div', { class: 'tools' }, link('📚 Resumo visual', '#/resumo/' + t.id, ''), link('🃏 Praticar', '#/revisar/topic/' + t.id, 'alt'), ouvir(t.title + '. Acertos ' + t.acc + ' por cento. Reforço recomendado.')))))]
      : el('p', {}, 'Ainda sem pontos fracos. Quando um assunto tiver acertos abaixo de 75%, ele aparece aqui com um resumo visual para aprofundar.'));
}

/* ---------- biblioteca de resumos visuais ---------- */
async function vLibrary() {
  const [s, ts] = await Promise.all([api('stats'), api('topics')]), acc = Object.fromEntries(s.topics.map((t) => [t.id, t.acc]));
  const tile = (t) => el('div', { class: 'box' }, el('b', {}, ico(t.emoji), ' ', el('a', { href: '#/resumo/' + t.id }, t.title)), el('br'), t.nv + (t.nv === 1 ? ' resumo visual' : ' resumos visuais'), acc[t.id] != null ? el('br') : '', acc[t.id] != null ? 'Acertos: ' + acc[t.id] + '%' : '', el('div', {}, ouvir(t.title + '. ' + t.nv + ' resumos visuais' + (acc[t.id] != null ? '. Acertos ' + acc[t.id] + ' por cento.' : ''))));
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
    stage.replaceChildren(el('div', { class: 'bigico' }, ico(v.emoji, 'wig')), el('h2', { tabindex: -1 }, v.title), el('ul', { class: 'chips' }, v.points.map((p) => el('li', {}, el('span', {}, p), ouvir(p)))),
      v.pitfall ? el('p', { class: 'warn' }, ico('⚠️'), ' ', el('b', {}, 'Cuidado: '), v.pitfall, ' ', ouvir('Cuidado: ' + v.pitfall)) : '', v.example ? el('p', { class: 'tip' }, ico('💡'), ' ', el('b', {}, 'Exemplo: '), v.example, ' ', ouvir('Exemplo: ' + v.example)) : '',
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
    el('div', { class: 'grid' }, Object.entries(ACH).map(([c, [e, n, d]]) => { const on = s.ach.includes(c); return el('div', { class: 'box badge ' + (on ? 'on' : 'off') }, el('div', { class: 'bigico' }, ico(on ? e : '🔒', on ? 'wig' : '')), el('b', {}, n), el('br'), d, el('br'), el('b', {}, on ? '✅ Conquistada' : 'Ainda bloqueada'), el('div', {}, ouvir(n + '. ' + d + ' ' + (on ? 'Conquistada.' : 'Ainda bloqueada.')))); })),
    el('h2', {}, 'Como ganhar XP'), el('p', {}, 'Cada cartão vale pontos pela sua nota: Errei +2, Difícil +6, Bom +10, Fácil +12. As estrelas do mapa vêm do domínio dos cartões de cada assunto.'));
}
async function vPkgs() {
  const s = await api('stats');
  return el('div', {}, el('h1', {}, ico('📦', 'bob'), ' Pacotes de estudo'), el('p', {}, 'Cada pacote tem um objetivo, uma trilha, cartões e resumos visuais. Pacotes novos são instalados pelo administrador.'),
    el('div', { class: 'grid' }, s.pkgs.map((p) => el('div', { class: 'box' }, el('div', { class: 'bigico' }, ico(p.emoji, 'bob')), el('b', {}, p.name), el('br'), 'Objetivo: ' + p.goal, el('div', {}, ouvir(p.name + '. Objetivo: ' + p.goal)),
      el('div', { class: 'tools' }, s.pkg && s.pkg.id === p.id ? el('b', {}, '✅ Pacote ativo') : btn('Usar este pacote', async () => { await api('pkg_set', { body: { id: p.id } }); notify('Pacote alterado.'); location.hash = '#/'; render(); }, ''))))),
    el('p', {}, link('📖 Fontes de estudo', '#/fontes', 'alt')));
}

/* ---------- trilhas: criar com IA, importar/exportar, prazo, metas e painel ---------- */
const KIND = { sistema: '📘 Do sistema', ia: '✨ Criada com IA', material: '📎 Com meus materiais', video: '🎬 A partir de vídeos', importada: '📥 Importada' };
const STATUS = { concluida: '🏁 Concluída', sem_prazo: '🧭 Sem prazo definido', no_prazo: '✅ No prazo', atencao: '⚠️ Atenção: o ritmo está abaixo do necessário', atrasado: '🚨 Atrasado: ajuste o prazo ou a carga semanal' };
const PACE = { 1: 40, 2: 32, 3: 24, 4: 18, 5: 12 };   // cartões por hora na 1ª passada, por dificuldade (1 fácil a 5 difícil)
const fmtMin = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + Math.round(m % 60) + ' min' : Math.round(m) + ' min');
const fmtDate = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString('pt-BR') : '—');
function analyze(d) {
  const pl = d.plan, ref = pl.paused_at || d.now, T = d.topics, cl = (v, a, b) => Math.max(a, Math.min(b, v)), base = (t) => 60 / PACE[t.difficulty || 3];
  const A = T.reduce((s, t) => s + t.tries, 0), ok = T.reduce((s, t) => s + t.ok, 0), acc = A ? Math.round(100 * ok / A) : null;
  const exp = A ? T.reduce((s, t) => s + t.tries * base(t), 0) / A : 1, obs = A ? d.studied_min / A : 1, w = Math.min(A, 60) / 60;
  const f = 1 + w * (cl(obs / exp, 0.6, 2) - 1), g = acc == null ? 1 : acc < 60 ? 1.25 : acc >= 85 ? 0.9 : 1;      // ritmo real do aluno e acertos ajustam a estimativa
  const est = T.map((t) => { const e = t.chunks * 3 + t.nv * 4 + t.n * base(t) * 3 * f * g, p = t.n ? t.k / t.n : 0; return { ...t, est: e, rem: e * (1 - p), pct: Math.round(100 * p) }; });
  const total = est.reduce((s, t) => s + t.est, 0), rem = est.reduce((s, t) => s + t.rem, 0), n = T.reduce((s, t) => s + t.n, 0), k = T.reduce((s, t) => s + t.k, 0);
  const content = n ? Math.round(100 * k / n) : 0, hpw = pl.hpw || 5, weekGoal = hpw * 60, weekDone = d.week.reduce((s, x) => s + x.min, 0), weekPct = Math.min(100, Math.round(100 * weekDone / weekGoal));
  const dl = pl.deadline, timePct = dl ? Math.round(cl(100 * (ref - pl.start_ts) / Math.max(1, dl - pl.start_ts), 0, 100)) : null, daysLeft = dl ? Math.max(0, Math.ceil((dl - ref) / 86400)) : null;
  const finish = ref + (rem / weekGoal) * 7 * 86400, slack = dl ? (dl - finish) / 86400 : null, pace = timePct ? Math.min(150, Math.round(100 * content / timePct)) : 100;
  const status = rem < 1 ? 'concluida' : !dl ? 'sem_prazo' : slack >= 0 ? 'no_prazo' : slack > -7 ? 'atencao' : 'atrasado', daily = dl ? rem / Math.max(1, daysLeft) : null;
  const sched = []; let cap = weekGoal, wk = { n: 1, items: [] };
  for (const t of est) { let r = t.rem; while (r > 0.5 && sched.length < 52) { const put = Math.min(r, cap); wk.items.push({ title: t.title, min: put }); r -= put; cap -= put; if (cap < 0.5) { sched.push(wk); wk = { n: wk.n + 1, items: [] }; cap = weekGoal; } } }
  if (wk.items.length) sched.push(wk);
  return { est, total, rem, content, acc, A, weekGoal, weekDone, weekPct, timePct, daysLeft, finish, slack, pace, status, daily, sched, ref, frozen: !!pl.paused_at };
}
function gauge(p, label, hint) { const g = el('div', { class: 'gauge', role: 'img', 'aria-label': label + ': ' + p + '%' }, el('span', {}, p + '%')); g.style.setProperty('--p', Math.max(0, Math.min(100, p))); return el('div', { class: 'gbox' }, g, el('b', {}, label), el('small', {}, hint)); }
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

async function exportRoute(id, name) {
  const x = await api('route_export', { qs: { id } }), txt = JSON.stringify(x, null, 1), file = (name || 'trilha').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-') + '.trilha.json';
  const a = el('a', { href: URL.createObjectURL(new Blob([txt], { type: 'application/json' })), download: file, class: 'btn big' }, '⬇️ Baixar ' + file);
  notify(''); live.append(el('div', { class: 'box' }, el('h2', {}, ico('📤'), ' Trilha exportada'), el('p', {}, 'Guarde o arquivo: ele restaura conteúdo, bibliografia, estratégia, progresso, prazo e metas.'), a, ' ', btn('📋 Copiar', () => navigator.clipboard.writeText(txt).then(() => toast('Copiado!')).catch(() => {}), 'alt'), el('textarea', { rows: 5, readonly: true, 'aria-label': 'Conteúdo da trilha exportada' }, txt)));
  a.click();
}

async function vRoutes() {
  const s = await api('routes');
  const card = (r) => {
    const pc = r.n ? Math.round(100 * r.k / r.n) : 0, paused = r.status !== 'ativa', cur = r.id === s.current;
    return el('div', { class: 'box' + (paused ? ' paused' : '') + (cur ? ' curr' : '') }, el('div', { class: 'bigico' }, ico(r.emoji, paused ? '' : 'bob')), el('b', {}, r.name), el('br'), KIND[r.kind] || r.kind, ' · ' + ({ privada: '🔒 Privada', grupos: '👥 Grupos', publica: '🌐 Pública' }[r.visibility] || ''), el('br'), r.goal,
      bar(pc, 'Domínio de ' + r.name), pc + '% dominado' + (r.deadline ? ' · prazo ' + fmtDate(r.deadline) : ''), el('br'), paused ? el('b', {}, '⏸️ Desativada: só visualização') : cur ? el('b', {}, '✅ Trilha em uso') : '',
      el('div', { class: 'tools' }, link('📊 Painel', '#/trilha/' + r.id, ''),
        el('button', { type: 'button', class: 'alt', disabled: paused || cur, onclick: async () => { await api('pkg_set', { body: { id: r.id } }); location.hash = '#/'; } }, '▶️ Usar'),
        act('route_state', { id: r.id, act: paused ? 'resume' : 'pause' }, null, paused ? '▶️ Reativar' : '⏸️ Desativar', 'alt'), btn('📤 Exportar', () => exportRoute(r.id, r.name), 'alt'),
        r.mine ? act('route_state', { id: r.id, act: 'delete' }, null, '🗑️ Excluir', 'alt', 'Excluir esta trilha? Ela some da sua lista e o tempo fica congelado. A exclusão definitiva depende da aprovação do administrador, que também pode restaurá-la.') : '', ouvir(r.name + '. ' + r.goal + '. ' + pc + ' por cento dominado.')));
  };
  return el('div', {}, el('h1', {}, ico('🧭', 'bob'), ' Trilhas de aprendizagem'), el('p', {}, 'Cada trilha tem objetivo, mapa, cartões, resumos visuais, prazo e metas. Crie novas com IA, importe uma trilha salva ou volte a uma anterior.'),
    el('div', { class: 'tools' }, link('✨ Nova trilha com IA', '#/trilhas/nova', 'big'), link('📥 Importar trilha', '#/trilhas/importar', 'alt big')), el('div', { class: 'grid' }, s.routes.map(card)), el('p', {}, link('📖 Fontes de estudo', '#/fontes', 'alt')));
}

function vImport() {
  const ta = field('Cole o conteúdo do arquivo .trilha.json', 'json', { tag: 'textarea', rows: 8 });
  const file = el('input', { id: 'tf', type: 'file', accept: '.json,application/json', onchange: async (e) => { const f = e.target.files[0]; if (f) $('textarea', ta).value = await f.text(); } });
  return el('div', {}, el('h1', {}, ico('📥'), ' Importar trilha'), el('p', {}, 'Restaura a trilha com conteúdos, bibliografia, estratégia, progresso, prazo e metas como foram exportados.'),
    form([ta, el('div', { class: 'f' }, el('label', { for: 'tf' }, 'Ou envie o arquivo'), file), el('p', {}, submit('Importar', 'big'))], async (d) => {
      const r = await api('route_import', { body: { json: d.json } }); await api('pkg_set', { body: { id: r.id } }); if (r.warning) toast('⚠️ ' + r.warning); location.hash = '#/trilha/' + r.id;
    }));
}

function paintSteps(box, pr) {
  if (!pr || !pr.steps) return; let ol = $('.steps', box); if (!ol) { ol = el('ol', { class: 'steps' }); box.append(ol); }
  const ic = { ok: '✅', andamento: '⏳', espera: '⚪', parcial: '⚠️' }, done = pr.steps.filter((s) => s.s === 'ok' || s.s === 'parcial').length, w = pr.steps.find((s) => s.k === 'escrever'), m = w && w.d ? /Assunto (\d+) de (\d+)/.exec(w.d) : null, frac = m && w.s === 'andamento' ? (m[1] - 1) / m[2] : 0;
  ol.replaceChildren(...pr.steps.map((s) => el('li', { class: 'st-' + s.s }, el('span', { class: 'sic', 'aria-hidden': 'true' }, ic[s.s] || '⚪'), el('span', {}, el('b', {}, s.t), s.d ? el('br') : '', s.d || '', pr.agentes && pr.agentes[s.k] ? el('small', {}, ' · agente: ' + pr.agentes[s.k]) : ''))));
  const old = $('.bar', box); const nb = bar(Math.round(100 * (done + frac) / pr.steps.length), 'Progresso da criação'); if (old) old.replaceWith(nb); else box.insertBefore(nb, ol);
}
async function pollJob(job) {
  const start = location.hash, box = el('section', { class: 'box hero' }, el('h2', {}, ico('🔎', 'bob'), ' Montando a sua trilha…'), el('p', { id: 'jm' }, 'Iniciando…'),
    el('p', {}, 'O orquestrador planeja a trilha, pesquisa a bibliografia e escreve um assunto de cada vez; se um agente falhar, outro assume. Pode levar alguns minutos. Se sair desta tela, a trilha aparece em "Trilhas" quando ficar pronta.'));
  view.replaceChildren(el('h1', {}, 'Criando trilha'), box);
  for (let i = 0; i < 400; i++) {
    await new Promise((r) => setTimeout(r, 3000)); if (location.hash !== start) return;
    let j; try { j = await api('route_job', { qs: { id: job } }); } catch { continue; }
    $('#jm', box).textContent = j.msg; paintSteps(box, j.progress);
    if (j.status === 'pronto') { await api('pkg_set', { body: { id: j.route_id } }); toast('🎉 Trilha pronta!'); burst(); location.hash = '#/trilha/' + j.route_id; return; }
    if (j.status === 'manual') { manualPanel(job, j, box); return; }
    if (j.status === 'erro') { notify(j.msg); box.append(link('Tentar de novo', '#/trilhas/nova', 'big')); return; }
  }
}

async function vNewRoute() {
  const info = await api('ia_status'), lib = (await api('materials')).materials, root = el('div', {}, el('h1', {}, ico('✨', 'wig'), ' Nova trilha com IA'));
  if (!info.enabled) root.append(el('div', { class: 'msg' }, '🛟 A IA automática não está configurada. Você ainda pode criar a trilha: o sistema monta o pedido e você usa qualquer IA ou agente de sua preferência (modo agente), ou cria um esqueleto. ', S.user.role === 'admin' ? link('Configurar a IA', '#/admin/ia', '') : ''));
  const st = { mode: 'tema', mats: [], vids: [], ids: [] }, mb = el('div', { class: 'tools', role: 'group', 'aria-label': 'Como montar a trilha' }), matBox = el('div'), vidBox = el('div');
  const bind = (f, o, k) => { const i = $('input,textarea', f); i.addEventListener('input', () => { o[k] = i.value; }); return f; };
  const b64 = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
  const clean = (t) => t.replace(/WEBVTT/g, '').replace(/^\d+\s*$/gm, '').replace(/\d{2}:\d{2}:\d{2}[.,]\d{3} --> .*/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const pick = (accept, onfile) => el('input', { type: 'file', accept, 'aria-label': 'Escolher arquivo', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 5e6) { notify('Arquivo grande demais (máximo 5 MB).'); return; } await onfile(f); paint(); } });
  function paint() {
    mb.replaceChildren(...[['tema', '💡 Por tema e objetivo'], ['material', '📎 Com meus materiais'], ['video', '🎬 A partir de vídeos']].map(([k, t]) => el('button', { type: 'button', class: st.mode === k ? 'on' : 'alt', 'aria-pressed': String(st.mode === k), onclick: () => { st.mode = k; paint(); } }, t)));
    matBox.replaceChildren(el('h2', {}, ico('📎'), ' Meus materiais bibliográficos ', st.mode === 'material' ? '(obrigatório: ao menos um)' : '(opcional)'), el('p', {}, 'Textos e anotações (.txt, .md) ou PDFs de até 5 MB. A IA prioriza o que você enviar e cita como material próprio.'),
      ...st.mats.map((m, i) => el('div', { class: 'box' }, bind(field('Título', 'mt', { value: m.title }), m, 'title'), bind(field('Autor e ano', 'ma', { value: m.author }), m, 'author'), bind(field('Texto (cole aqui) ou use o arquivo', 'mx', { tag: 'textarea', rows: 4, value: m.text }), m, 'text'),
        pick('.txt,.md,.html,.pdf,text/plain,application/pdf', async (f) => { if (/\.pdf$/i.test(f.name)) m.pdf = await b64(f); else m.text = await f.text(); if (!m.title) m.title = f.name; }), m.pdf ? el('p', {}, '📄 PDF anexado') : '', btn('Remover', () => { st.mats.splice(i, 1); paint(); }, 'alt'))),
      btn('➕ Adicionar material', () => { st.mats.push({ title: '', author: '', text: '', pdf: '' }); paint(); }, 'alt'));
    vidBox.replaceChildren(el('h2', {}, ico('🎬'), ' Vídeos ', st.mode === 'video' ? '(obrigatório: ao menos um)' : '(opcional)'), el('p', {}, 'Cole o link. A trilha usa a fala do vídeo (a transcrição) como contexto do argumento. Em branco, o servidor tenta obter as legendas do YouTube; se não conseguir, cole a transcrição ou envie um .txt/.srt/.vtt.'),
      ...st.vids.map((v, i) => el('div', { class: 'box' }, bind(field('Link do vídeo', 'vu', { type: 'url', value: v.url }), v, 'url'), bind(field('Transcrição (opcional)', 'vt', { tag: 'textarea', rows: 3, value: v.transcript }), v, 'transcript'),
        pick('.txt,.srt,.vtt,text/plain', async (f) => { v.transcript = clean(await f.text()); }), btn('Remover', () => { st.vids.splice(i, 1); paint(); }, 'alt'))),
      btn('➕ Adicionar vídeo', () => { st.vids.push({ url: '', transcript: '' }); paint(); }, 'alt'));
  }
  paint();
  const libBox = el('div', {}, lib.length ? [el('h2', {}, ico('🗂️'), ' Da minha biblioteca de materiais'), ...lib.map((m) => el('div', { class: 'f' }, el('label', {}, el('input', { type: 'checkbox', onchange: (e) => { st.ids = e.target.checked ? [...st.ids, m.id] : st.ids.filter((x) => x !== m.id); } }), ' ' + m.title)))] : '');
  root.append(el('p', {}, 'Conte o que quer aprender e aonde quer chegar. A IA pesquisa a bibliografia atual, propõe a estratégia de estudos e escreve a trilha completa (assuntos, cartões e resumos visuais).' + (info.admin ? '' : ' Você gerou ' + info.used + ' de ' + info.limit + ' trilhas nas últimas 24 h.')),
    form([el('h2', {}, ico('🧬'), ' Dados base da trilha'), el('p', {}, 'A IA usa estes dados para planejar, pesquisar e escrever a sua trilha, etapa por etapa.'), el('h2', {}, 'Como quer montar?'), mb, field('Tema ou descrição do que quer estudar', 'theme', { tag: 'textarea', rows: 3 }), field('Objetivo final da trilha (ex.: passar na prova X, explicar o assunto Y)', 'objective', { req: true }),
      select('Seu nível hoje', 'level', [['iniciante', 'Iniciante'], ['intermediário', 'Intermediário'], ['avançado', 'Avançado']], 'iniciante'), select('Como você aprende melhor', 'style', [['misto', 'Um pouco de tudo'], ['leitura', 'Lendo textos curtos'], ['audio', 'Ouvindo'], ['pratica', 'Praticando com perguntas'], ['visual', 'Com esquemas e imagens']], 'misto'), field('Minutos por sessão de estudo', 'session', { type: 'number', value: 25 }), field('Temas e conteúdos que quer cobrir (um por linha, opcional)', 'themes', { tag: 'textarea', rows: 4 }),
      libBox, matBox, vidBox, el('h2', {}, ico('⏱️'), ' Prazo e carga'), field('Prazo final (opcional)', 'deadline', { type: 'date' }), field('Horas de estudo por semana', 'hpw', { type: 'number', value: 5 }),
      el('p', {}, 'O sistema estima o tempo de conclusão pela dificuldade de cada assunto e pelo seu ritmo, e mostra no painel se você está no prazo.'), el('p', {}, submit('✨ Gerar trilha com IA', 'big'))],
      async (d) => {
        const mats = st.mats.filter((m) => m.title || m.text || m.pdf), vids = st.vids.filter((v) => v.url);
        if (st.mode === 'tema' && !d.theme.trim()) throw new Error('Descreva o tema que quer estudar.');
        if (st.mode === 'material' && !mats.length && !st.ids.length) throw new Error('Adicione ao menos um material.');
        if (st.mode === 'video' && !vids.length) throw new Error('Adicione ao menos um vídeo.');
        const j = await api('route_create', { body: { mode: st.mode, theme: d.theme, objective: d.objective, level: d.level, style: d.style, session: d.session, themes: d.themes, deadline: d.deadline, hpw: d.hpw, materials: mats, videos: vids, material_ids: st.ids } });
        pollJob(j.job);
      }));
  return root;
}

async function vRoute(id) {
  const d = await api('route_data', { qs: { id } }), a = analyze(d), r = d.route, pl = d.plan, paused = pl.status !== 'ativa', n = d.topics.reduce((s, t) => s + t.n, 0), k = d.topics.reduce((s, t) => s + t.k, 0);
  const dlReal = pl.deadline ? pl.deadline + (pl.paused_at ? d.now - pl.paused_at : 0) : null, dlIn = dlReal ? new Date(dlReal * 1000).toISOString().slice(0, 10) : '';
  const ex = a.status === 'concluida' ? 'Você dominou todos os cartões desta trilha.' : `Faltam cerca de ${fmtMin(a.rem)} de estudo. Com ${pl.hpw} h por semana, a previsão de conclusão é ${fmtDate(a.finish)}` + (dlReal ? `; o prazo é ${fmtDate(dlReal)} (${a.daysLeft} dias). Para cumprir, estude cerca de ${fmtMin(a.daily)} por dia.` : '. Defina um prazo para ver o plano.') + (a.frozen ? ' O tempo está congelado enquanto a trilha estiver desativada.' : '');
  const mx = Math.max(10, ...d.week.map((x) => x.min));
  const url = (b) => (safeUrl(b.url) ? [' ', el('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer' }, 'abrir fonte')] : '');
  return el('div', { class: paused ? 'paused' : '' }, el('h1', {}, ico(r.emoji, 'bob'), ' ', r.name), el('p', {}, el('b', {}, 'Objetivo: '), r.objective || r.goal), el('p', {}, KIND[r.kind] || r.kind, paused ? ' · ⏸️ Desativada: só visualização; tempo e metas congelados.' : ''),
    el('div', { class: 'tools' }, el('button', { type: 'button', class: 'big', disabled: paused, onclick: async () => { await api('pkg_set', { body: { id } }); location.hash = '#/'; } }, '▶️ Estudar esta trilha'),
      act('route_state', { id, act: paused ? 'resume' : 'pause' }, null, paused ? '▶️ Reativar' : '⏸️ Desativar', 'alt'), btn('📤 Exportar', () => exportRoute(id, r.name), 'alt'),
      d.mine ? act('route_state', { id, act: 'delete' }, () => { location.hash = '#/trilhas'; }, '🗑️ Excluir', 'alt', 'Excluir esta trilha? Ela some da sua lista e o tempo fica congelado. A exclusão definitiva depende da aprovação do administrador, que também pode restaurá-la.') : '', link('Todas as trilhas', '#/trilhas', 'alt')),
    el('section', { class: 'box hero' }, el('h2', {}, STATUS[a.status]), el('p', {}, ex, ' ', ouvir(STATUS[a.status] + '. ' + ex))),
    el('h2', {}, ico('📊'), ' Indicadores'),
    el('div', { class: 'grid' }, gauge(a.content, 'Conteúdo dominado', k + ' de ' + n + ' cartões'), gauge(a.timePct ?? 0, 'Prazo decorrido', dlReal ? a.daysLeft + ' dias restantes' : 'sem prazo'), gauge(Math.min(100, a.pace), 'Ritmo frente ao plano', 'índice ' + a.pace + '%'), gauge(a.weekPct, 'Meta da semana', fmtMin(a.weekDone) + ' de ' + fmtMin(a.weekGoal)), gauge(a.acc ?? 0, 'Acertos', a.A + ' respostas')),
    el('h2', {}, 'Estudo nos últimos 7 dias'),
    el('div', { class: 'wk-chart', role: 'img', 'aria-label': 'Minutos estudados por dia: ' + d.week.map((x) => x.d.slice(8) + '/' + x.d.slice(5, 7) + ' ' + Math.round(x.min) + ' min').join(', ') },
      d.week.map((x) => { const b = el('i'); b.style.height = Math.round(100 * x.min / mx) + '%'; return el('div', { class: 'col' }, el('span', {}, Math.round(x.min) + ''), el('div', { class: 'barv' }, b), el('small', {}, x.d.slice(8) + '/' + x.d.slice(5, 7))); })),
    el('h2', {}, 'Prazo e carga semanal'),
    el('section', { class: 'box' }, form([field('Prazo final para concluir', 'deadline', { type: 'date', value: dlIn }), field('Horas de estudo por semana', 'hpw', { type: 'number', value: pl.hpw }), el('p', {}, submit('Salvar e recalcular'))],
      async (f) => { await api('route_plan', { body: { id, deadline: f.deadline, hpw: f.hpw } }); notify('Plano atualizado.'); await render(true); })),
    d.mine ? await shareBox(id, d) : '',
    el('h2', {}, 'Assuntos: dificuldade e tempo estimado'),
    a.est.map((t) => el('div', { class: 'row' }, el('div', { class: 'grow' }, ico(t.emoji), ' ', el('b', {}, t.title), el('br'), 'Dificuldade ' + '●'.repeat(t.difficulty || 3) + '○'.repeat(5 - (t.difficulty || 3)) + ' · estimado ' + fmtMin(t.est) + ' · ' + t.pct + '% dominado', bar(t.pct, 'Domínio de ' + t.title)))),
    el('h2', {}, 'Cronograma sugerido'),
    a.sched.length ? el('ol', {}, a.sched.slice(0, 10).map((w) => el('li', {}, 'Semana ' + w.n + ' (a partir de ' + fmtDate(a.ref + (w.n - 1) * 7 * 86400) + '): ' + w.items.map((i) => i.title + ' (' + fmtMin(i.min) + ')').join('; ')))) : el('p', {}, 'Nada pendente: trilha concluída.'),
    r.strategy.length ? [el('h2', {}, ico('🧠'), ' Estratégia de estudos'), el('ul', {}, r.strategy.map((s) => el('li', {}, el('b', {}, s.tecnica), ': ', s.como, s.frequencia ? ' (' + s.frequencia + ')' : '', ' ', ouvir(s.tecnica + '. ' + s.como))))] : '',
    r.biblio.length ? [el('h2', {}, ico('📚'), ' Bibliografia'), el('ul', {}, r.biblio.map((b) => el('li', {}, el('b', {}, b.titulo), [b.autores, b.ano].filter(Boolean).length ? ' (' + [b.autores, b.ano].filter(Boolean).join(', ') + ')' : '', b.tipo ? ' · ' + b.tipo : '', b.por_que ? el('span', {}, el('br'), b.por_que) : '', b.verificada === false ? el('span', {}, el('br'), '⚠️ Confirme esta referência antes de usar.') : '', url(b), ' ', ouvir(b.titulo + '. ' + (b.por_que || '')))))] : '',
    (r.sources.videos || []).length ? [el('h2', {}, ico('🎬'), ' Vídeos usados'), el('ul', {}, r.sources.videos.map((v) => el('li', {}, v.titulo || v.url, ' ', v.transcricao ? '(transcrição usada)' : '(sem transcrição)')))] : '');
}

/* ---------- comunidade: explorar, trilha pública, grupos, materiais; contingência de IA ---------- */
const VIS = { privada: '🔒 Privada', grupos: '👥 Grupos', publica: '🌐 Pública' };
const likeBtn = (t) => btn((t.liked ? '💖 ' : '🤍 ') + (t.likes || 0), async () => { await api('route_like', { body: { id: t.id } }); await render(true); }, 'alt');
const pubCard = (t) => el('article', { class: 'box pub' }, el('div', { class: 'pub-top' }, el('span', { class: 'avatar', 'aria-hidden': 'true' }, (t.author || 'S')[0].toUpperCase()), el('span', {}, el('b', {}, t.author || 'Sistema'), el('br'), KIND[t.kind] || t.kind)),
  el('div', { class: 'bigico' }, ico(t.emoji, 'bob')), el('h3', {}, el('a', { href: '#/comunidade/' + t.id }, t.name)), el('p', {}, t.goal),
  el('div', { class: 'chips2' }, (t.tags || []).slice(0, 4).map((x) => el('a', { href: '#/explorar?q=' + encodeURIComponent(x) }, '#' + x))),
  el('p', { class: 'stats' }, '❤️ ' + (t.likes || 0) + ' · 👥 ' + (t.followers || 0) + ' · 📥 ' + (t.clones || 0) + (t.ntopics ? ' · 📚 ' + t.ntopics : '')),
  el('div', { class: 'tools' }, link('Ver trilha', '#/comunidade/' + t.id, ''), t.likes != null ? likeBtn(t) : '', ouvir(t.name + '. ' + t.goal)));
async function communityStrip() {
  let x; try { x = (await api('explore', { qs: { sort: 'populares', limit: 4 } })).routes.filter((r) => !r.mine).slice(0, 3); } catch { return ''; }
  return x.length ? el('section', { class: 'box' }, el('h2', {}, ico('🌐'), ' Em alta na comunidade'), el('div', { class: 'grid' }, x.map(pubCard)), el('div', { class: 'tools' }, link('Explorar tudo', '#/explorar', 'alt'))) : '';
}
async function vExplore(Q) {
  const q = Q.get('q') || '', kind = Q.get('kind') || '', sort = Q.get('sort') || 'populares', x = await api('explore', { qs: { q, kind, sort } });
  const go = (d) => { const h = '#/explorar?' + new URLSearchParams(Object.fromEntries(Object.entries(d).filter(([, v]) => v))).toString(); if (location.hash === h) render(); else location.hash = h; };
  return el('div', {}, el('h1', {}, ico('🧭', 'bob'), ' Explorar trilhas'), el('p', {}, 'Cursos e rotas de estudo criados pela comunidade, para objetivos específicos. Estude uma trilha, copie para a sua conta ou compartilhe as suas.'),
    el('section', { class: 'box' }, form([field('Buscar por tema, técnica ou objetivo', 'q', { value: q }), el('div', { class: 'grid' }, select('Tipo', 'kind', [['', 'Todos'], ...Object.entries(KIND)], kind), select('Ordem', 'sort', [['populares', 'Mais populares'], ['recentes', 'Mais recentes']], sort)), el('p', {}, submit('🔍 Buscar'))], async (d) => go(d))),
    x.routes.length ? el('div', { class: 'grid' }, x.routes.map(pubCard)) : el('p', {}, 'Nenhuma trilha encontrada. Que tal criar a primeira sobre esse tema?'), el('div', { class: 'tools' }, link('✨ Criar minha trilha', '#/trilhas/nova', 'big')));
}
async function vPublic(id) {
  const t = await api('route_public', { qs: { id } }), reload = () => render(true), sys = !t.owner_id, url = (b) => (safeUrl(b.url) ? [' ', el('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer' }, 'abrir fonte')] : '');
  return el('div', {}, el('article', { class: 'box hero pubhead' }, el('div', { class: 'pub-top' }, el('span', { class: 'avatar', 'aria-hidden': 'true' }, (t.author || 'S')[0].toUpperCase()), el('span', {}, el('b', {}, t.author || 'Sistema'), el('br'), (KIND[t.kind] || t.kind) + ' · ' + (VIS[t.visibility] || '🌐 Pública') + (t.groups.length ? ' (' + t.groups.join(', ') + ')' : ''))),
      el('h1', {}, ico(t.emoji, 'bob'), ' ', t.name), el('p', {}, t.objective || t.goal), el('div', { class: 'chips2' }, t.tags.map((x) => el('a', { href: '#/explorar?q=' + encodeURIComponent(x) }, '#' + x))),
      el('p', { class: 'stats' }, '❤️ ' + t.likes + ' · 👥 ' + t.followers + ' estudando · 📥 ' + t.clones + ' cópias · 📚 ' + t.topics.length + ' assuntos'),
      el('div', { class: 'tools' }, t.mine || t.following ? link('📊 Abrir painel', '#/trilha/' + id, 'big') : btn('▶️ Estudar esta trilha', async () => { await api('route_follow', { body: { id } }); location.hash = '#/trilha/' + id; }, 'big'),
        !t.mine ? btn('📥 Copiar para minha conta', async () => { const r = await api('route_clone', { body: { id } }); toast('📥 Trilha copiada!'); burst(); location.hash = '#/trilha/' + r.id; }, 'alt big') : '', likeBtn(t),
        t.following && !t.mine && !sys ? act('route_unfollow', { id }, null, 'Deixar de seguir', 'alt') : '', t.is_admin && !t.mine && t.visibility !== 'privada' ? act('route_visibility', { id, visibility: 'privada', tags: t.tags.join(','), groups: [] }, null, '🚫 Despublicar (moderação)', 'alt', 'Despublicar esta trilha?') : '', ouvir(t.name + '. ' + (t.objective || t.goal)))),
    t.strategy.length ? [el('h2', {}, ico('🧠'), ' Estratégia de estudos'), el('ul', {}, t.strategy.map((s) => el('li', {}, el('b', {}, s.tecnica), ': ', s.como, s.frequencia ? ' (' + s.frequencia + ')' : '')))] : '',
    t.biblio.length ? [el('h2', {}, ico('📚'), ' Bibliografia'), el('ul', {}, t.biblio.map((b) => el('li', {}, el('b', {}, b.titulo), [b.autores, b.ano].filter(Boolean).length ? ' (' + [b.autores, b.ano].filter(Boolean).join(', ') + ')' : '', b.por_que ? el('span', {}, el('br'), b.por_que) : '', b.verificada === false ? el('span', {}, el('br'), '⚠️ Confirme esta referência.') : '', url(b))))] : '',
    el('h2', {}, 'Assuntos da trilha'), el('div', { class: 'grid' }, t.topics.map((x) => el('div', { class: 'box' }, ico(x.emoji), ' ', el('b', {}, x.title), el('br'), 'Dificuldade ' + '●'.repeat(x.difficulty || 3) + '○'.repeat(5 - (x.difficulty || 3)) + ' · ' + x.n + ' cartões'))),
    el('h2', {}, ico('💬'), ' Comentários (' + t.comments.length + ')'), form([field('Escreva um comentário', 'text', { req: true }), el('p', {}, submit('Comentar'))], async (d, f) => { await api('route_comment', { body: { id, text: d.text } }); f.reset(); await reload(); }),
    t.comments.map((c) => el('div', { class: 'row' }, el('div', {}, el('b', {}, c.uname), ' · ' + fmtDate(c.created), el('br'), c.text), c.mine || t.mine || t.is_admin ? act('comment_del', { id: c.id }, null, 'Apagar', 'alt') : '')));
}
async function vGroups() {
  const s = await api('groups');
  return el('div', {}, el('h1', {}, ico('👥', 'bob'), ' Grupos de estudo'), el('p', {}, 'Compartilhe trilhas só com quem você escolher. Para entrar num grupo, use o código de convite.'),
    el('div', { class: 'grid' }, s.groups.map((g) => el('div', { class: 'box' }, el('b', {}, el('a', { href: '#/grupo/' + g.id }, g.name)), el('br'), g.descr, el('br'), g.members + ' membros · ' + g.trails + ' trilhas' + (g.owner ? ' · você é o dono' : ''), g.code ? el('p', {}, 'Código: ', el('span', { class: 'tok' }, g.code)) : '', ouvir(g.name + '. ' + g.members + ' membros.')))),
    el('div', { class: 'grid' }, el('section', { class: 'box' }, el('h2', {}, 'Criar grupo'), form([field('Nome', 'name', { req: true }), field('Descrição', 'descr'), el('p', {}, submit('Criar grupo'))], async (d) => { await api('group_create', { body: d }); notify('Grupo criado.'); await render(true); })),
      el('section', { class: 'box' }, el('h2', {}, 'Entrar com código'), form([field('Código do convite', 'code', { req: true, cls: 'tok' }), el('p', {}, submit('Entrar'))], async (d) => { await api('group_join', { body: d }); notify('Você entrou no grupo.'); await render(true); }))));
}
async function vGroup(id) {
  const g = await api('group_data', { qs: { id } });
  return el('div', {}, el('h1', {}, ico('👥'), ' ', g.name), el('p', {}, g.descr), g.code ? el('p', {}, 'Código de convite: ', el('span', { class: 'tok' }, g.code)) : '',
    el('h2', {}, 'Trilhas compartilhadas'), g.trails.length ? el('div', { class: 'grid' }, g.trails.map(pubCard)) : el('p', {}, 'Nenhuma trilha compartilhada ainda. O autor escolhe os grupos no painel da trilha.'),
    el('h2', {}, 'Membros (' + g.members.length + ')'), el('ul', {}, g.members.map((m) => el('li', {}, m.name + (m.role === 'dono' ? ' (dono)' : '')))),
    g.owner || g.is_admin ? act('group_del', { id }, () => { location.hash = '#/grupos'; }, '🗑️ Excluir grupo', 'alt', 'Excluir o grupo? As trilhas deixam de ser compartilhadas com ele.') : act('group_leave', { id }, () => { location.hash = '#/grupos'; }, 'Sair do grupo', 'alt'));
}
async function vMaterials() {
  const s = await api('materials'), KINDS = [['texto', '📝 Texto e anotações'], ['link', '🔗 Link ou artigo'], ['video', '🎬 Vídeo'], ['pdf', '📄 PDF']];
  const matForm = (m) => {
    const st = { pdf: '' };
    const f = form([field('Título', 'title', { req: true, value: m.title }), field('Autor e ano', 'author', { value: m.author }), select('Tipo', 'kind', KINDS, m.kind || 'texto'), field('Link (opcional)', 'url', { type: 'url', value: m.url }), field('Texto (cole aqui)', 'text', { tag: 'textarea', rows: 5, value: m.text }), field('Etiquetas (separadas por vírgula)', 'tags', { value: (m.tags || []).join(', ') }),
      el('div', { class: 'f' }, el('label', {}, 'Arquivo (.txt, .md ou .pdf até 4 MB)'), el('input', { type: 'file', accept: '.txt,.md,.pdf,text/plain,application/pdf', onchange: async (e) => { const fl = e.target.files[0]; if (!fl) return; if (fl.size > 4e6) { notify('Arquivo grande demais.'); return; } if (/\.pdf$/i.test(fl.name)) st.pdf = await b64file(fl); else $('textarea', f).value = await fl.text(); } })), el('p', {}, submit('Salvar material'))],
      async (d) => { await api('material_save', { body: { id: m.id || 0, ...d, pdf: st.pdf } }); notify('Material salvo.'); await render(true); });
    return f;
  };
  return el('div', {}, el('h1', {}, ico('🗂️', 'bob'), ' Meus materiais'), el('p', {}, 'Guarde textos, anotações, links e PDFs. Ao criar uma trilha com IA, escolha quais materiais ela deve usar e citar.'),
    el('details', { class: 'box' }, el('summary', { class: 'btn' }, '➕ Novo material'), matForm({})),
    el('div', { class: 'grid' }, s.materials.map((m) => { const box = el('div', { class: 'box' }, el('b', {}, m.title), el('br'), (KINDS.find((k) => k[0] === m.kind) || [0, ''])[1] + (m.has_pdf ? ' · PDF anexado' : ''), el('p', {}, m.excerpt), el('div', { class: 'chips2' }, (m.tags || []).map((x) => el('span', {}, '#' + x))));
      box.append(el('div', { class: 'tools' }, btn('✏️ Editar', async () => { const full = await api('material_get', { qs: { id: m.id } }); box.replaceChildren(matForm(full)); }, 'alt'), act('material_del', { id: m.id }, null, '🗑️ Excluir', 'alt', 'Excluir este material?'), ouvir(m.title + '. ' + m.excerpt))); return box; })));
}
async function shareBox(id, d) {
  const gs = (await api('groups')).groups, vs = [['privada', '🔒 Privada (só eu)'], ['grupos', '👥 Só os grupos que eu escolher'], ['publica', '🌐 Pública (todos podem ver)']];
  return el('section', { class: 'box' }, el('h2', {}, ico('🌐'), ' Compartilhamento'), el('p', {}, 'Torne a trilha pública para a comunidade ou compartilhe só com grupos. Outros usuários podem estudar e copiar; o progresso e o painel de cada um continuam só dele.'),
    form([select('Quem pode ver', 'visibility', vs, d.route.visibility || 'privada'), field('Etiquetas (separadas por vírgula)', 'tags', { value: (d.route.tags || []).join(', ') }),
      gs.length ? el('div', {}, el('b', {}, 'Grupos com acesso (vale quando a opção for "grupos"):'), gs.map((g) => el('div', { class: 'f' }, el('label', {}, el('input', { type: 'checkbox', name: 'g' + g.id, checked: d.shares.includes(g.id) }), ' ' + g.name)))) : el('p', {}, 'Você ainda não tem grupos. ', link('Criar um grupo', '#/grupos', 'alt')),
      el('p', {}, submit('Salvar compartilhamento'))], async (f, fe) => { const groups = gs.filter((g) => fe.elements['g' + g.id] && fe.elements['g' + g.id].checked).map((g) => g.id); await api('route_visibility', { body: { id, visibility: f.visibility, tags: f.tags, groups } }); notify('Compartilhamento atualizado.'); await render(true); }));
}
function manualPanel(job, j, box) {
  const m = j.manual || {}, ta = field('Cole aqui a resposta da IA (o JSON)', 'text', { tag: 'textarea', rows: 8 });
  box.replaceChildren(el('h2', {}, ico('🛟', 'bob'), ' Modo agente: a IA automática não está disponível'), el('p', {}, j.msg),
    el('p', {}, '1) Copie o pedido abaixo e cole em qualquer IA ou agente (ChatGPT, Gemini, Claude, Copilot, um modelo local…). 2) Cole a resposta aqui. O sistema ajusta o formato sozinho.'),
    el('textarea', { rows: 6, readonly: true, 'aria-label': 'Pedido para a IA' }, m.prompt || ''), btn('📋 Copiar pedido', () => navigator.clipboard.writeText(m.prompt || '').then(() => toast('Pedido copiado!')).catch(() => {}), 'alt'),
    form([ta, el('p', {}, submit('Montar a trilha com a resposta', 'big'))], async (d) => { const r = await api('route_manual', { body: { job, text: d.text } }); await api('pkg_set', { body: { id: r.id } }); toast('🎉 Trilha criada!'); burst(); location.hash = '#/trilha/' + r.id; }),
    el('div', { class: 'tools' }, btn('🔄 Tentar a IA de novo', async () => { await api('route_retry', { body: { job } }); pollJob(job); }, 'alt'),
      btn('📝 Criar esqueleto agora (sem IA)', async () => { const r = await api('route_skeleton', { body: { job } }); await api('pkg_set', { body: { id: r.id } }); location.hash = '#/trilha/' + r.id; }, 'alt')));
}
async function expandTopic(id) {
  notify('✨ Gerando mais cartões… pode levar um minuto.');
  const r = await api('topic_expand', { body: { id } });
  if (!r.manual) { toast('✨ ' + r.added + ' itens novos' + (r.provider ? ' (' + r.provider + ')' : '')); await render(true); return; }
  const ta = field('Cole aqui a resposta da IA (JSON)', 'text', { tag: 'textarea', rows: 6 });
  notify(''); live.append(el('section', { class: 'box' }, el('h2', {}, ico('🛟'), ' Modo agente'), el('p', {}, 'A IA automática não respondeu: ' + r.manual.error), el('p', {}, 'Copie o pedido, cole em qualquer IA ou agente e traga a resposta de volta.'),
    el('textarea', { rows: 5, readonly: true, 'aria-label': 'Pedido para a IA' }, r.manual.prompt), btn('📋 Copiar pedido', () => navigator.clipboard.writeText(r.manual.prompt).then(() => toast('Copiado!')).catch(() => {}), 'alt'),
    form([ta, el('p', {}, submit('Aplicar resposta'))], async (d) => { const x = await api('topic_expand_apply', { body: { id, text: d.text } }); toast('✨ ' + x.added + ' itens novos'); await render(true); })));
}

/* ---------- escolha da versão (antes de começar) e menu "Mais" ---------- */
function vChooser() {
  const al = S.editions || 'ambas';
  const O = [['portal', '🌐', 'Portal', 'Comunidade de estudo para computador e tablet.', ['Explore e copie trilhas da comunidade', 'Grupos, comentários e curtidas', 'Biblioteca de materiais e cursos para objetivos específicos', 'Visual colorido, animado e cheio de conquistas']],
    ['acessivel', '📱', 'Mobile acessível', 'Feito para o celular e para quem enxerga pouco.', ['Letras grandes e alto contraste', 'Leitura em voz alta de cada item', 'Menu inferior simples, com 5 botões grandes', 'Revisões curtas e mapa da trilha']]].filter((o) => al === 'ambas' || al === o[0]);
  if (O.length === 1) { setTimeout(() => choose(O[0][0]), 0); return el('p', {}, 'Abrindo…'); }
  const txt = (o, i) => 'Opção ' + (i + 1) + ': ' + o[2] + '. ' + o[3] + ' ' + o[4].join('. ') + '.';
  const keys = (e) => { if (e.target.matches('input,textarea')) return; const o = O[+e.key - 1]; if (o) choose(o[0]); };
  document.addEventListener('keydown', keys); cleanup = () => document.removeEventListener('keydown', keys);
  return el('div', {}, el('div', { class: 'hero-logo' }, el('img', { class: 'logo-big', src: LOGO, alt: '' })), el('h1', {}, ico('✨', 'wig'), ' Como você quer usar o Estudo Claro?'),
    el('p', {}, 'Escolha a versão que combina com você. Dá para trocar depois em Mais → Trocar de versão. As teclas ', el('b', {}, '1'), ' e ', el('b', {}, '2'), ' também escolhem.'),
    el('div', { class: 'tools' }, btn('🔊 Ouvir as opções', () => say(O.map(txt).join(' ')), 'alt big'), btn('Parar', () => speechSynthesis.cancel(), 'alt')),
    el('div', { class: 'opts' }, O.map((o, i) => el('section', { class: 'box opt', 'aria-labelledby': 'o' + i }, el('div', { class: 'bigico' }, ico(o[1], 'bob')), el('h2', { id: 'o' + i }, o[2]), el('p', {}, o[3]), el('ul', {}, o[4].map((x) => el('li', {}, x))),
      el('div', { class: 'tools' }, btn((i + 1) + ' · Usar ' + o[2], () => choose(o[0]), 'big'), ouvir(txt(o, i)))))),
    el('p', {}, '💡 Se você tem dificuldade para ler a tela, escolha ', el('b', {}, 'Mobile acessível'), '.'));
}
function vMore() {
  const L = [['🧭', 'Explorar a comunidade', '#/explorar'], ['👥', 'Grupos', '#/grupos'], ['🗂️', 'Meus materiais', '#/materiais'], ['🏆', 'Conquistas', '#/conquistas'], ['⚙️', 'Ajustes de leitura', '#/ajustes'], ['📖', 'Fontes de estudo', '#/fontes']];
  if (S.user.role === 'admin') L.push(['🛠️', 'Administração', '#/admin/users']);
  L.push(['🔀', 'Trocar de versão', '#/versao']);
  return el('div', {}, el('h1', {}, ico('☰'), ' Mais opções'), el('div', { class: 'grid' }, L.map(([e, t, h]) => link(e + ' ' + t, h, 'alt big'))), el('p', {}, btn('🚪 Sair da conta (' + S.user.name + ')', logout, 'big')));
}

/* ---------- administração ---------- */
const act = (route, body, then, label, cls = 'alt', ask) => btn(label, async () => {
  if (ask && !confirm(ask)) return;
  try { const r = await api(route, { body }); if (then) then(r); await render(true); } catch (x) { notify(x.message); }
}, cls);
async function vAdmin(tab) {
  const tabs = el('nav', { 'aria-label': 'Administração' }, [['users', 'Usuários'], ['tokens', 'Tokens'], ['requests', 'Pedidos'], ['packages', 'Pacotes'], ['versoes', 'Versões'], ['ia', 'IA'], ['dels', 'Exclusões'], ['content', 'Conteúdo']].map(([k, t]) => link(t, '#/admin/' + k, tab === k ? 'on' : 'alt')));
  const root = el('div', {}, el('h1', {}, 'Administração'), tabs);
  if (tab === 'versoes') {
    const c = await api('a_cfg');
    root.append(el('section', { class: 'box' }, el('h2', {}, 'Versões oferecidas'), el('p', {}, 'Antes de começar, cada pessoa escolhe entre o portal (comunidade, computador e tablet) e o mobile acessível (celular e baixa visão). Você pode oferecer as duas ou só uma.'),
      form([select('Versões', 'editions', [['ambas', 'As duas: o usuário escolhe'], ['portal', 'Só o portal'], ['acessivel', 'Só o mobile acessível']], c.editions), el('p', {}, submit('Salvar'))], async (d) => { await api('a_cfg_set', { body: d }); notify('Salvo.'); await render(true); })));
    return root;
  }
  if (tab === 'ia') {
    const c = await api('a_ia'), P = c.providers.map((p) => ({ ...p, key: '' })), list = el('div');
    const bindv = (f, o, k) => { const i = $('input,textarea,select', f); i.addEventListener('input', () => { o[k] = i.value; }); return f; };
    const chk = (label, o, k) => el('div', { class: 'f' }, el('label', {}, el('input', { type: 'checkbox', checked: !!o[k], onchange: (e) => { o[k] = e.target.checked; } }), ' ' + label));
    const paintP = () => list.replaceChildren(...P.map((p, i) => el('details', { class: 'box' }, el('summary', { class: 'btn alt' }, (p.enabled ? '🟢 ' : '⚪ ') + (p.label || c.types[p.type]) + ' · prioridade ' + (i + 1) + (c.health[p.id] && c.health[p.id].until > Date.now() / 1000 ? ' · em pausa' : '')),
      bindv(select('Tipo', 't', Object.entries(c.types), p.type), p, 'type'), bindv(field('Nome', 'l', { value: p.label }), p, 'label'), bindv(select('Papel na criação da trilha', 'r', [['qualquer', 'Qualquer etapa'], ['planejador', 'Planejador (monta o plano e a bibliografia)'], ['redator', 'Redator (escreve cada assunto)']], p.role || 'qualquer'), p, 'role'),
      bindv(field('Chave da API' + (p.hint ? ' (atual ' + p.hint + '; deixe em branco para manter)' : ''), 'k', { type: 'password', ac: 'off' }), p, 'key'), bindv(field('Modelo (vazio = padrão do tipo)', 'm', { value: p.model }), p, 'model'),
      bindv(field('Endereço base (opcional; ex.: http://localhost:11434/v1 para um modelo local)', 'u', { value: p.base_url }), p, 'base_url'),
      chk('Pesquisa na web (Claude com busca, Gemini com Google Search)', p, 'search'), chk('Ativo', p, 'enabled'),
      el('div', { class: 'tools' }, btn('⬆️ Subir prioridade', () => { if (i) { [P[i - 1], P[i]] = [P[i], P[i - 1]]; paintP(); } }, 'alt'), btn('Remover', () => { P.splice(i, 1); paintP(); }, 'alt'),
        btn('Testar (salve antes)', async () => { try { const r = await api('a_ia_test', { body: { id: p.id } }); notify('✅ ' + (p.label || p.type) + ': ' + r.resp); } catch (x) { notify('❌ ' + x.message); } }, 'alt')))));
    paintP();
    root.append(el('section', { class: 'box' }, el('h2', {}, '🛟 Agentes de IA com contingência'), el('p', {}, 'A criação da trilha é orquestrada em etapas: um agente planejador monta o plano e a bibliografia e um agente redator escreve cada assunto (sem papel definido, qualquer agente serve). O sistema tenta os agentes na ordem da lista. Se um falhar ou responder fora do formato, passa ao próximo; um provedor que falha duas vezes fica 10 minutos em pausa. Se todos falharem, o usuário recebe o modo agente (copiar o pedido para qualquer IA e colar a resposta) ou um esqueleto sem IA. As chaves ficam no servidor e nunca vão ao navegador.'), list,
      btn('➕ Adicionar provedor', () => { P.push({ id: '', type: 'openai', label: '', key: '', model: '', base_url: '', search: false, enabled: true, hint: '' }); paintP(); }, 'alt'),
      form([select('IA automática ligada', 'enabled', [[1, 'Sim'], [0, 'Não (só modo agente)']], c.enabled ? 1 : 0), field('Limite de trilhas por usuário por dia', 'limit', { type: 'number', value: c.limit }), el('p', {}, submit('Salvar provedores', 'big'))],
        async (d) => { await api('a_ia_save', { body: { providers: P, enabled: d.enabled, limit: d.limit } }); notify('Configuração salva.'); await render(true); })));
    return root;
  }
  if (tab === 'dels') {
    const l = await api('a_dels'); root.append(el('p', {}, 'Trilhas que usuários excluíram. Enquanto não houver decisão, ficam escondidas do usuário e com o tempo congelado.'));
    if (!l.length) root.append(el('p', {}, 'Nenhuma trilha aguardando decisão.'));
    for (const x of l) root.append(el('div', { class: 'row' }, el('div', {}, ico(x.emoji), ' ', el('b', {}, x.name), el('br'), 'Excluída por ' + x.uname + ' (' + x.email + ') em ' + fmtDate(x.deleted_at)),
      el('div', { class: 'tools' }, act('a_del', { id: x.id, act: 'restore' }, null, '♻️ Restaurar', ''), act('a_del', { id: x.id, act: 'approve' }, null, '🗑️ Apagar de vez', 'alt', 'Apagar definitivamente a trilha ' + x.name + '? Isso não pode ser desfeito.'))));
    return root;
  }
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
  const [path, qstr = ''] = location.hash.replace(/^#\/?/, '').split('?'), [r, a, b] = path.split('/'), Q = new URLSearchParams(qstr);
  let node, title = S.name;
  try {
    if (!ED() || r === 'versao') { node = vChooser(); title = 'Escolha a versão'; }
    else if (!S.user) { node = vHome(); }
    else if (r === 'topicos') { node = await vTopics(); title = 'Conteúdo'; }
    else if (r === 'resumos') { node = await vLibrary(); title = 'Resumos visuais'; }
    else if (r === 'resumo') { node = await vDeck(+a); title = 'Resumo visual'; }
    else if (r === 'conquistas') { node = await vAch(); title = 'Conquistas'; }
    else if (r === 'trilhas' && a === 'nova') { node = await vNewRoute(); title = 'Nova trilha'; }
    else if (r === 'trilhas' && a === 'importar') { node = vImport(); title = 'Importar trilha'; }
    else if (r === 'trilhas' || r === 'pacotes') { node = await vRoutes(); title = 'Trilhas'; }
    else if (r === 'trilha') { node = await vRoute(+a); title = 'Painel da trilha'; }
    else if (r === 'explorar') { node = await vExplore(Q); title = 'Explorar'; }
    else if (r === 'comunidade') { node = await vPublic(+a); title = 'Trilha da comunidade'; }
    else if (r === 'grupos') { node = await vGroups(); title = 'Grupos'; }
    else if (r === 'grupo') { node = await vGroup(+a); title = 'Grupo'; }
    else if (r === 'materiais') { node = await vMaterials(); title = 'Materiais'; }
    else if (r === 'mais') { node = vMore(); title = 'Mais'; }
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
  document.querySelectorAll('#nav a').forEach((x) => { const h = (x.getAttribute('href') || '').split('/')[1] || ''; x.classList.toggle('cur', h === (r || '')); });
}
addEventListener('hashchange', () => render());

/* ---------- início ---------- */
(async () => {
  try { await boot(); } catch (e) { view.replaceChildren(el('h1', {}, 'Sem conexão'), el('p', {}, 'Não foi possível falar com o servidor. Verifique a internet e tente de novo.'), btn('Tentar de novo', () => location.reload(), 'big')); return; }
  await render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
