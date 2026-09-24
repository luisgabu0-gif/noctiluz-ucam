<?php
// Crea (o reinicia) la base de datos SQLite de pruebas y un app/config.php local.
// Uso, desde la carpeta del proyecto:   php database/instalar_local.php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("Este script solo se ejecuta desde la línea de comandos.\n");
}
if (!extension_loaded('pdo_sqlite')) {
    exit("Falta la extensión pdo_sqlite: actívala en php.ini (extension=pdo_sqlite).\n");
}

$raiz = dirname(__DIR__);
$ruta = "$raiz/public_html/datos/noctiluz.sqlite";
if (is_file($ruta)) {
    unlink($ruta);
}

$pdo = new PDO("sqlite:$ruta", null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec(file_get_contents(__DIR__ . '/esquema_sqlite.sql'));
$pdo->exec(file_get_contents(__DIR__ . '/datos_prueba.sql'));

$config = "$raiz/public_html/app/config.php";
if (!is_file($config)) {
    $contenido = file_get_contents("$raiz/public_html/app/config.ejemplo.php");
    $contenido = str_replace(["'driver'      => 'mysql'", "'entorno' => 'produccion'"], ["'driver'      => 'sqlite'", "'entorno' => 'desarrollo'"], $contenido);
    file_put_contents($config, $contenido);
    echo "Creado public_html/app/config.php (SQLite, modo desarrollo).\n";
}

$n = $pdo->query('SELECT (SELECT COUNT(*) FROM productos) p, (SELECT COUNT(*) FROM variantes) v, (SELECT COUNT(*) FROM pedidos) o, (SELECT COUNT(*) FROM eventos) e')->fetch(PDO::FETCH_ASSOC);
echo "Base de datos lista en public_html/datos/noctiluz.sqlite: {$n['p']} productos, {$n['v']} variantes, {$n['o']} pedidos y {$n['e']} eventos de ejemplo.\n";
echo "Arranca el servidor con:  php -S localhost:8000 -t public_html\n";
