<?php
/**
 * Autoinstalador: roda sozinho no primeiro acesso (index.php chama este arquivo enquanto não houver config.php).
 * Depois de instalado, qualquer acesso direto a install.php é redirecionado.
 */
declare(strict_types=1);
require_once __DIR__ . '/inc/lib.php';
if (installed()) { header('Location: ' . base()); exit; }
boot_session();

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

/* escolhe onde guardar o banco: fora da pasta pública, se possível */
function data_dir(): string {
    $outside = dirname(ROOT) . '/' . basename(ROOT) . '_dados';
    if ((is_dir($outside) && is_writable($outside)) || (is_writable(dirname(ROOT)) && @mkdir($outside, 0750))) return $outside;
    return ROOT . '/data';
}
$checks = [
    ['PHP 8.0 ou superior (atual: ' . PHP_VERSION . ')', PHP_VERSION_ID >= 80000],
    ['Extensão pdo_sqlite', extension_loaded('pdo_sqlite')],
    ['Extensão mbstring/json', function_exists('json_encode')],
    ['Pasta do sistema com permissão de escrita', is_writable(ROOT)],
];
$ready = !in_array(false, array_column($checks, 1), true);
$keyFile = ROOT . '/install.key';
$needKey = is_file($keyFile);
$err = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $ready) {
    try {
        if (!hash_equals(csrf(), (string)($_POST['c'] ?? ''))) throw new RuntimeException('Sessão expirada. Recarregue a página.');
        if ($needKey && !hash_equals(trim((string)file_get_contents($keyFile)), trim((string)($_POST['key'] ?? '')))) throw new RuntimeException('Chave de instalação incorreta.');
        $name = trim((string)$_POST['site']) ?: 'Estudo Claro'; $an = trim((string)$_POST['name']); $ae = strtolower(trim((string)$_POST['email'])); $ap = (string)$_POST['pass'];
        if ($an === '' || !filter_var($ae, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Informe nome e e-mail válidos.');
        if (strlen($ap) < 8) throw new RuntimeException('A senha precisa ter 8 ou mais caracteres.');
        if ($ap !== (string)$_POST['pass2']) throw new RuntimeException('As senhas não conferem.');

        $dir = data_dir();
        if (!is_dir($dir) && !@mkdir($dir, 0750, true)) throw new RuntimeException('Não foi possível criar a pasta de dados.');
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
        @file_put_contents($dir . '/web.config', '<?xml version="1.0"?><configuration><system.webServer><authorization><deny users="*"/></authorization></system.webServer></configuration>');
        @file_put_contents($dir . '/index.html', '');

        $d = db($dir . '/app.sqlite');
        $d->beginTransaction();
        schema($d);
        if (!empty($_POST['seed'])) seed($d);
        $d->prepare('INSERT INTO users(name,email,pass,role,prefs,created) VALUES(?,?,?,?,?,?)')->execute([$an, $ae, password_hash($ap, PASSWORD_DEFAULT), 'admin', '{}', time()]);
        $d->commit();

        $fh = @fopen(ROOT . '/config.php', 'x');           // 'x' falha se já existir: evita instalação dupla
        if (!$fh) throw new RuntimeException('Não foi possível gravar config.php (ou o sistema já foi instalado).');
        fwrite($fh, "<?php\nreturn " . var_export(['data' => $dir, 'name' => $name, 'installed' => date('c')], true) . ";\n"); fclose($fh);
        if ($needKey) @unlink($keyFile);
        header('Location: ' . base() . '#/entrar'); exit;
    } catch (Throwable $e) {
        if (isset($d) && $d->inTransaction()) $d->rollBack();
        if (isset($dir) && isset($d) && !is_file(ROOT . '/config.php')) { $d = null; @unlink($dir . '/app.sqlite'); @unlink($dir . '/app.sqlite-wal'); @unlink($dir . '/app.sqlite-shm'); }
        $err = $e->getMessage();
    }
}
http_response_code(200);
?><!doctype html>
<html lang="pt-BR" data-theme="claro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Instalação · Estudo Claro</title><link rel="stylesheet" href="assets/app.css"><script src="assets/theme.js"></script></head>
<body><main style="max-width:44rem;margin:0 auto;padding:1rem">
<h1>Instalação do Estudo Claro</h1>
<p>Este é o primeiro acesso neste servidor. Preencha os dados abaixo: o instalador cria o banco de dados SQLite, o administrador e o conteúdo inicial, e trava a si mesmo ao terminar.</p>
<section class="box"><h2>Verificação do servidor</h2><ul>
<?php foreach ($checks as $c): ?><li><?= h($c[0]) ?>: <b><?= $c[1] ? 'ok' : 'FALHOU' ?></b></li><?php endforeach; ?>
</ul><p>Os dados serão guardados em: <code><?= h(data_dir()) ?></code></p></section>
<?php if ($err): ?><div class="msg" role="alert"><?= h($err) ?></div><?php endif; ?>
<?php if ($ready): ?>
<form method="post"><input type="hidden" name="c" value="<?= h(csrf()) ?>">
<?php if ($needKey): ?><div class="f"><label for="k">Chave de instalação (conteúdo do arquivo install.key)</label><input id="k" name="key" required autocomplete="off"></div><?php endif; ?>
<div class="f"><label for="s">Nome da plataforma</label><input id="s" name="site" value="Estudo Claro"></div>
<div class="f"><label for="n">Nome do administrador</label><input id="n" name="name" required autocomplete="name"></div>
<div class="f"><label for="e">E-mail do administrador</label><input id="e" name="email" type="email" required autocomplete="email"></div>
<div class="f"><label for="p">Senha (mínimo 8 caracteres)</label><input id="p" name="pass" type="password" minlength="8" required autocomplete="new-password"></div>
<div class="f"><label for="p2">Repita a senha</label><input id="p2" name="pass2" type="password" minlength="8" required autocomplete="new-password"></div>
<div class="f"><label><input type="checkbox" name="seed" value="1" checked> Incluir os assuntos e cartões de exemplo (Direito Administrativo)</label></div>
<p><button class="big" type="submit">Instalar agora</button></p></form>
<?php else: ?><div class="msg" role="alert">Corrija os itens marcados como FALHOU (fale com a hospedagem se preciso) e recarregue esta página.</div><?php endif; ?>
</main></body></html>
