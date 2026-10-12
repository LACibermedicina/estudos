<?php
declare(strict_types=1);
require __DIR__ . '/inc/lib.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (!installed()) out(['installing' => true, 'error' => 'Sistema ainda não instalado.'], 503);
boot_session();

$r = (string)($_GET['r'] ?? 'boot');
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$in = $post ? (json_decode((string)file_get_contents('php://input'), true) ?: []) : [];
if ($post && !hash_equals(csrf(), (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) out(['error' => 'Sessão expirada. Recarregue a página.'], 419);

function user(): array { $u = me(); if (!$u) out(['error' => 'Entre para continuar.'], 401); return $u; }
function admin(): array { $u = user(); if ($u['role'] !== 'admin') out(['error' => 'Acesso restrito.'], 403); return $u; }
function str(array $a, string $k, int $max = 2000): string { return substr(trim((string)($a[$k] ?? '')), 0, $max); }
function login_as(int $id): void { session_regenerate_id(true); $_SESSION['uid'] = $id; }
function ip(): string { return substr($_SERVER['REMOTE_ADDR'] ?? '0', 0, 45); }
function pubuser(?array $u): ?array { return $u ? ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role'], 'prefs' => $u['prefs'], 'xp' => (int)$u['xp']] : null; }
function curpkg(array $u): int {
    $p = (int)q('SELECT pkg FROM users WHERE id=?', [$u['id']])->fetchColumn();
    if ($p && q('SELECT 1 FROM packages WHERE id=?', [$p])->fetch()) return $p;
    return (int)q('SELECT id FROM packages ORDER BY id LIMIT 1')->fetchColumn();
}

switch ($r) {
    case 'boot':
        out(['user' => pubuser(me()), 'csrf' => csrf(), 'name' => cfg('name') ?: 'Estudo Claro']);

    case 'login':
        $k = ip(); $now = time();
        q('DELETE FROM attempts WHERE ts<?', [$now - 3600]);
        if ((int)q('SELECT COUNT(*) FROM attempts WHERE k=? AND ts>?', [$k, $now - 600])->fetchColumn() >= 8) out(['error' => 'Muitas tentativas. Aguarde 10 minutos.'], 429);
        $u = q('SELECT * FROM users WHERE email=?', [strtolower(str($in, 'email', 200))])->fetch();
        if (!$u || $u['status'] !== 'ativo' || !password_verify((string)($in['pass'] ?? ''), $u['pass'])) {
            q('INSERT INTO attempts(k,ts) VALUES(?,?)', [$k, $now]); usleep(300000);
            out(['error' => 'E-mail ou senha incorretos, ou conta bloqueada.'], 401);
        }
        q('DELETE FROM attempts WHERE k=?', [$k]); login_as((int)$u['id']);
        out(['ok' => 1]);

    case 'register':
        $tk = strtoupper(str($in, 'token', 40)); $em = strtolower(str($in, 'email', 200)); $nm = str($in, 'name', 120); $pw = (string)($in['pass'] ?? '');
        $t = q('SELECT * FROM tokens WHERE token=? AND used_by IS NULL AND (expires IS NULL OR expires>?)', [$tk, time()])->fetch();
        if (!$t) out(['error' => 'Token inválido, já usado ou vencido.'], 400);
        if (!filter_var($em, FILTER_VALIDATE_EMAIL) || $nm === '' || strlen($pw) < 8) out(['error' => 'Preencha nome, e-mail válido e senha com 8 ou mais caracteres.'], 400);
        if (q('SELECT 1 FROM users WHERE email=?', [$em])->fetch()) out(['error' => 'Este e-mail já está cadastrado.'], 409);
        db()->beginTransaction();
        q('INSERT INTO users(name,email,pass,role,prefs,created) VALUES(?,?,?,?,?,?)', [$nm, $em, password_hash($pw, PASSWORD_DEFAULT), $t['role'], '{}', time()]);
        $id = (int)db()->lastInsertId(); q('UPDATE tokens SET used_by=? WHERE id=?', [$id, $t['id']]);
        db()->commit(); login_as($id); out(['ok' => 1]);

    case 'request':
        $em = strtolower(str($in, 'email', 200)); $nm = str($in, 'name', 120);
        if (!filter_var($em, FILTER_VALIDATE_EMAIL) || $nm === '') out(['error' => 'Informe nome e e-mail válidos.'], 400);
        if ((int)q("SELECT COUNT(*) FROM requests WHERE email=? AND status='pendente'", [$em])->fetchColumn() >= 2) out(['error' => 'Já existe um pedido pendente para este e-mail.'], 409);
        q('INSERT INTO requests(name,email,msg,created) VALUES(?,?,?,?)', [$nm, $em, str($in, 'msg', 500), time()]);
        out(['ok' => 1]);

    case 'logout': $_SESSION = []; session_destroy(); out(['ok' => 1]);

    case 'prefs':
        $u = user(); $p = clean_prefs($in);
        q('UPDATE users SET prefs=? WHERE id=?', [json_encode($p), $u['id']]); out(['prefs' => $p]);

    case 'stats':
        $u = user(); $now = time(); $id = (int)$u['id']; $pk = curpkg($u);
        $pkg = q('SELECT id,name,goal,emoji FROM packages WHERE id=?', [$pk])->fetch() ?: null;
        $tot = (int)q('SELECT COUNT(*) FROM cards c JOIN topics t ON t.id=c.topic_id WHERE t.package_id=?', [$pk])->fetchColumn();
        $due = (int)q('SELECT COUNT(*) FROM cards c JOIN topics t ON t.id=c.topic_id LEFT JOIN progress p ON p.card_id=c.id AND p.user_id=? WHERE t.package_id=? AND (p.id IS NULL OR p.due<=?)', [$id, $pk, $now])->fetchColumn();
        $known = (int)q('SELECT COUNT(*) FROM progress p JOIN cards c ON c.id=p.card_id JOIN topics t ON t.id=c.topic_id WHERE p.user_id=? AND t.package_id=? AND p.reps>=2', [$id, $pk])->fetchColumn();
        $w = q('SELECT COUNT(*) n, IFNULL(SUM(grade>=2),0) ok FROM logs WHERE user_id=? AND ts>?', [$id, $now - 7 * 86400])->fetch();
        $rev = (int)q('SELECT COUNT(*) FROM logs WHERE user_id=?', [$id])->fetchColumn();
        $xp = (int)q('SELECT xp FROM users WHERE id=?', [$id])->fetchColumn();
        $days = q("SELECT DISTINCT date(ts,'unixepoch') d FROM logs WHERE user_id=? ORDER BY d DESC LIMIT 400", [$id])->fetchAll(PDO::FETCH_COLUMN);
        $streak = 0; $cur = new DateTimeImmutable('today', new DateTimeZone('UTC'));
        if ($days && $days[0] !== $cur->format('Y-m-d')) $cur = $cur->modify('-1 day');
        foreach ($days as $d) { if ($d === $cur->format('Y-m-d')) { $streak++; $cur = $cur->modify('-1 day'); } else break; }
        $topics = q('SELECT t.id,t.title,t.emoji,COUNT(c.id) n, IFNULL(SUM(CASE WHEN p.reps>=2 THEN 1 ELSE 0 END),0) k, (SELECT COUNT(*) FROM visuals v WHERE v.topic_id=t.id) nv FROM topics t LEFT JOIN cards c ON c.topic_id=t.id LEFT JOIN progress p ON p.card_id=c.id AND p.user_id=? WHERE t.package_id=? GROUP BY t.id ORDER BY t.pos', [$id, $pk])->fetchAll();
        $tr = [];
        foreach (q('SELECT c.topic_id tid, COUNT(*) n, SUM(l.grade>=2) ok FROM logs l JOIN cards c ON c.id=l.card_id WHERE l.user_id=? GROUP BY c.topic_id', [$id])->fetchAll() as $x) $tr[$x['tid']] = $x;
        $weak = [];
        foreach ($topics as &$t) {
            $pc = $t['n'] ? $t['k'] / $t['n'] : 0; $t['stars'] = $pc >= 1 ? 3 : ($pc >= 0.66 ? 2 : ($pc >= 0.33 ? 1 : 0));
            $x = $tr[$t['id']] ?? null; $t['tries'] = $x ? (int)$x['n'] : 0; $t['acc'] = $x ? (int)round(100 * $x['ok'] / $x['n']) : null;
            if ($t['tries'] >= 3 && $t['acc'] < 75) $weak[] = $t;
        }
        unset($t);
        usort($weak, fn($a, $b) => $a['acc'] <=> $b['acc']); $weak = array_map(fn($t) => (int)$t['id'], array_slice($weak, 0, 3));
        $st = array_column($topics, 'stars'); $lvl = (int)floor(sqrt($xp / 30)) + 1; $ach = [];
        foreach ([['primeiro', $rev >= 1], ['cartoes50', $rev >= 50], ['cartoes200', $rev >= 200], ['seq3', $streak >= 3], ['seq7', $streak >= 7], ['estrela', $st && max($st) >= 1], ['tres', $st && max($st) >= 3], ['mapa', $st && min($st) >= 1], ['nivel5', $lvl >= 5], ['aprovado', $st && min($st) >= 3]] as $c) if ($c[1]) $ach[] = $c[0];
        out(['pkg' => $pkg, 'pkgs' => q('SELECT id,name,emoji,goal FROM packages ORDER BY id')->fetchAll(), 'xp' => $xp, 'reviews' => $rev, 'ach' => $ach, 'weak' => $weak,
             'total' => $tot, 'due' => $due, 'known' => $known, 'acc' => $w['n'] ? (int)round(100 * $w['ok'] / $w['n']) : null, 'streak' => $streak, 'topics' => $topics]);

    case 'pkg_set':
        $u = user(); $pid = (int)($in['id'] ?? 0);
        if (!q('SELECT 1 FROM packages WHERE id=?', [$pid])->fetch()) out(['error' => 'Pacote não encontrado.'], 404);
        q('UPDATE users SET pkg=? WHERE id=?', [$pid, $u['id']]); out(['ok' => 1]);

    case 'topics':
        $u = user(); out(q('SELECT t.id,t.title,t.law,t.emoji,COUNT(c.id) n,(SELECT COUNT(*) FROM visuals v WHERE v.topic_id=t.id) nv FROM topics t LEFT JOIN cards c ON c.topic_id=t.id WHERE t.package_id=? GROUP BY t.id ORDER BY t.pos', [curpkg($u)])->fetchAll());

    case 'topic':
        user(); $t = q('SELECT * FROM topics WHERE id=?', [(int)($_GET['id'] ?? 0)])->fetch();
        if (!$t) out(['error' => 'Assunto não encontrado.'], 404);
        $t['chunks'] = array_values(array_filter(array_map('trim', explode("\n", (string)$t['summary']))));
        $t['nv'] = (int)q('SELECT COUNT(*) FROM visuals WHERE topic_id=?', [$t['id']])->fetchColumn();
        unset($t['summary']); out($t);

    case 'visuals':
        user(); $rows = q('SELECT id,emoji,title,points,pitfall,example FROM visuals WHERE topic_id=? ORDER BY pos,id', [(int)($_GET['id'] ?? 0)])->fetchAll();
        foreach ($rows as &$x) $x['points'] = json_decode((string)$x['points'], true) ?: [];
        unset($x); out($rows);

    case 'queue':
        $u = user(); $mode = (string)($_GET['mode'] ?? 'due'); $tid = (int)($_GET['id'] ?? 0); $now = time(); $pk = curpkg($u);
        $b = 'SELECT c.id,c.q,c.a,t.title FROM cards c JOIN topics t ON t.id=c.topic_id LEFT JOIN progress p ON p.card_id=c.id AND p.user_id=?';
        if ($mode === 'topic') $rows = q("$b WHERE c.topic_id=? ORDER BY RANDOM() LIMIT 8", [$u['id'], $tid])->fetchAll();
        elseif ($mode === 'exam') $rows = q("$b WHERE t.package_id=? ORDER BY RANDOM() LIMIT 10", [$u['id'], $pk])->fetchAll();
        elseif ($mode === 'mix') $rows = q("$b WHERE t.package_id=? AND (p.id IS NULL OR p.due<=?) ORDER BY RANDOM() LIMIT 8", [$u['id'], $pk, $now])->fetchAll();
        else $rows = q("$b WHERE t.package_id=? AND (p.id IS NULL OR p.due<=?) ORDER BY (p.id IS NULL), p.due, c.topic_id LIMIT 8", [$u['id'], $pk, $now])->fetchAll();
        out($rows);

    case 'grades':
        $u = user(); $n = 0;
        foreach (array_slice((array)($in['grades'] ?? []), 0, 200) as $g) {
            $cid = (int)($g['card'] ?? 0); $gr = max(0, min(3, (int)($g['grade'] ?? 0))); $ts = (int)($g['ts'] ?? time());
            if ($ts > time() + 300 || $ts < time() - 30 * 86400) $ts = time();
            if (q('SELECT 1 FROM cards WHERE id=?', [$cid])->fetch()) { review((int)$u['id'], $cid, $gr, $ts); $n++; }
        }
        out(['saved' => $n]);

    /* ---------- administração ---------- */
    case 'a_users':
        admin(); out(q('SELECT id,name,email,role,status FROM users ORDER BY id')->fetchAll());
    case 'a_user':
        $me = admin(); $id = (int)($in['id'] ?? 0); $act = (string)($in['act'] ?? '');
        if ($id === (int)$me['id'] && $act !== 'pwd') out(['error' => 'Você não pode fazer isso com a própria conta.'], 400);
        if ($act === 'toggle') q("UPDATE users SET status=CASE status WHEN 'ativo' THEN 'bloqueado' ELSE 'ativo' END WHERE id=?", [$id]);
        elseif ($act === 'del') q('DELETE FROM users WHERE id=?', [$id]);
        elseif ($act === 'pwd') { $pw = (string)($in['pass'] ?? ''); if (strlen($pw) < 8) out(['error' => 'A senha precisa ter 8 ou mais caracteres.'], 400); q('UPDATE users SET pass=? WHERE id=?', [password_hash($pw, PASSWORD_DEFAULT), $id]); }
        out(['ok' => 1]);

    case 'a_tokens': admin(); out(q('SELECT * FROM tokens ORDER BY id DESC LIMIT 100')->fetchAll());
    case 'a_token':
        admin(); $act = (string)($in['act'] ?? '');
        if ($act === 'gen') {
            $n = max(1, min(50, (int)($in['n'] ?? 1))); $days = max(0, (int)($in['days'] ?? 7)); $role = ($in['role'] ?? '') === 'admin' ? 'admin' : 'aluno';
            for ($i = 0; $i < $n; $i++) q('INSERT INTO tokens(token,role,expires,created) VALUES(?,?,?,?)', [mktoken(), $role, $days ? time() + $days * 86400 : null, time()]);
        } elseif ($act === 'del') q('DELETE FROM tokens WHERE id=? AND used_by IS NULL', [(int)($in['id'] ?? 0)]);
        out(['ok' => 1]);

    case 'a_reqs': admin(); out(q('SELECT * FROM requests ORDER BY id DESC LIMIT 200')->fetchAll());
    case 'a_req':
        admin(); $id = (int)($in['id'] ?? 0); $act = (string)($in['act'] ?? ''); $tk = null;
        if ($act === 'approve') { $tk = mktoken(); q('INSERT INTO tokens(token,role,expires,created) VALUES(?,?,?,?)', [$tk, 'aluno', time() + 7 * 86400, time()]); q("UPDATE requests SET status='aprovado', token=? WHERE id=?", [$tk, $id]); }
        elseif ($act === 'refuse') q("UPDATE requests SET status='recusado' WHERE id=?", [$id]);
        elseif ($act === 'del') q('DELETE FROM requests WHERE id=?', [$id]);
        out(['ok' => 1, 'token' => $tk]);

    case 'a_content':
        $ad = admin(); $t = q('SELECT * FROM topics WHERE package_id=? ORDER BY pos', [curpkg($ad)])->fetchAll();
        foreach ($t as &$x) $x['cards'] = q('SELECT id,q,a FROM cards WHERE topic_id=? ORDER BY id', [$x['id']])->fetchAll();
        out($t);
    case 'a_topic':
        $ad = admin(); $id = (int)($in['id'] ?? 0); $act = (string)($in['act'] ?? 'save');
        if ($act === 'del') { q('DELETE FROM topics WHERE id=?', [$id]); out(['ok' => 1]); }
        $v = [str($in, 'title', 200), str($in, 'law', 300), str($in, 'summary', 8000), str($in, 'mnemonic', 400)];
        if ($v[0] === '') out(['error' => 'Informe o título.'], 400);
        if ($id) q('UPDATE topics SET title=?,law=?,summary=?,mnemonic=? WHERE id=?', [...$v, $id]);
        else q('INSERT INTO topics(title,law,summary,mnemonic,package_id,emoji,pos) VALUES(?,?,?,?,?,?,(SELECT IFNULL(MAX(pos),0)+1 FROM topics))', [...$v, curpkg($ad), '📖']);
        out(['ok' => 1]);
    case 'a_card':
        admin(); $id = (int)($in['id'] ?? 0); $act = (string)($in['act'] ?? 'save');
        if ($act === 'del') { q('DELETE FROM cards WHERE id=?', [$id]); out(['ok' => 1]); }
        $qq = str($in, 'q', 1000); $aa = str($in, 'a', 2000);
        if ($qq === '' || $aa === '') out(['error' => 'Preencha pergunta e resposta.'], 400);
        q('INSERT INTO cards(topic_id,q,a) VALUES(?,?,?)', [(int)($in['topic_id'] ?? 0), $qq, $aa]); out(['ok' => 1]);

    case 'a_pkgs': admin(); out(q('SELECT p.id,p.slug,p.name,p.emoji,p.goal,(SELECT COUNT(*) FROM topics t WHERE t.package_id=p.id) topics FROM packages p ORDER BY p.id')->fetchAll());
    case 'a_pkg_import':
        admin();
        try { $j = json_decode(substr(trim((string)($in['json'] ?? '')), 0, 3000000), true); if (!is_array($j)) throw new RuntimeException('JSON inválido.'); install_package($j); }
        catch (Throwable $e) { out(['error' => $e->getMessage()], 400); }
        out(['ok' => 1]);
    case 'a_pkg_del':
        admin(); if ((int)q('SELECT COUNT(*) FROM packages')->fetchColumn() <= 1) out(['error' => 'Mantenha ao menos um pacote instalado.'], 400);
        q('DELETE FROM packages WHERE id=?', [(int)($in['id'] ?? 0)]); out(['ok' => 1]);

    default: out(['error' => 'Rota desconhecida.'], 404);
}
