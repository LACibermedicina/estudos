<?php
declare(strict_types=1);
require __DIR__ . '/inc/lib.php';
if (!installed()) { require __DIR__ . '/install.php'; exit; }   // primeiro acesso: autoinstalador
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: same-origin'); header('X-Frame-Options: DENY');
if (is_https()) header('Strict-Transport-Security: max-age=31536000');
$name = htmlspecialchars((string)(cfg('name') ?: 'Estudo Claro'), ENT_QUOTES, 'UTF-8');
?><!doctype html>
<html lang="pt-BR" data-theme="claro">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title><?= $name ?></title><meta name="description" content="Estudo e revisão de Direito Administrativo para baixa visão.">
<meta name="theme-color" content="#5428d8"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/app.css"><script src="assets/theme.js"></script></head>
<body>
<a class="skip" href="#c">Pular para o conteúdo</a>
<header><div class="in">
 <strong class="brand"><?= $name ?></strong>
 <div class="tools" role="group" aria-label="Ajustes de leitura">
  <button class="alt" type="button" data-act="fs-" aria-label="Diminuir letra">A−</button>
  <button class="alt" type="button" data-act="fs+" aria-label="Aumentar letra">A+</button>
  <button class="alt" type="button" data-act="theme" aria-label="Trocar contraste">Contraste</button>
  <button class="alt" type="button" data-act="read" aria-label="Ouvir esta página">Ouvir</button>
  <button class="alt" type="button" data-act="stop" aria-label="Parar leitura">Parar</button>
 </div>
 <div id="hud" aria-label="Pontos e nível"></div>
 <nav id="nav" aria-label="Principal"></nav>
</div></header>
<main id="c" tabindex="-1"><div id="live" role="status" aria-live="polite"></div><div id="view"><p>Carregando…</p></div></main>
<noscript><p>Esta plataforma precisa de JavaScript ativado.</p></noscript>
<script type="module" src="assets/app.js"></script>
</body></html>
