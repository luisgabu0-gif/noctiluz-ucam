<?php
declare(strict_types=1);

// Arranque común de todos los endpoints: carga la configuración y las clases, fija cabeceras
// y convierte cualquier excepción en una respuesta JSON coherente.

$raiz = dirname(__DIR__) . '/app';
foreach (['Db', 'Validador', 'ReglasNegocio', 'Catalogo', 'Eventos', 'Clientes', 'Pedidos', 'Pagos', 'Incidencias', 'Admin'] as $clase) {
    require_once "$raiz/$clase.php";
}

date_default_timezone_set('Europe/Madrid');
// Algunos hostings fijan serialize_precision=17 y json_encode saca 14.9000000000000003552...
ini_set('serialize_precision', '-1');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$GLOBALS['entorno'] = 'produccion';

set_exception_handler(function (Throwable $e) {
    if ($e instanceof ErrorNegocio) {
        responder(['error' => $e->getMessage(), 'campos' => (object) $e->detalles], $e->http);
    }
    error_log('[NOCTILUZ] ' . $e);
    $mensaje = $GLOBALS['entorno'] === 'desarrollo' ? $e->getMessage() : 'Error interno del servidor.';
    responder(['error' => $mensaje], 500);
});

if (!is_file("$raiz/config.php")) {
    responder(['error' => 'Falta app/config.php (copia app/config.ejemplo.php y rellénalo).'], 500);
}
$config = require "$raiz/config.php";
$GLOBALS['entorno'] = $config['entorno'] ?? 'produccion';
Db::configurar($config['db']);

function responder($datos, int $codigo = 200): void
{
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function metodo(): string
{
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

function permitir(string ...$metodos): void
{
    if (!in_array(metodo(), $metodos, true)) {
        header('Allow: ' . implode(', ', $metodos));
        responder(['error' => 'Método no permitido.'], 405);
    }
}

/** Lee el cuerpo JSON de la petición (máx. 64 KB). */
function cuerpoJson(): array
{
    $crudo = file_get_contents('php://input', false, null, 0, 65536);
    $datos = json_decode($crudo ?: '[]', true);
    if (!is_array($datos)) {
        throw new ErrorNegocio('El cuerpo de la petición debe ser JSON.', [], 400);
    }
    return $datos;
}

function parametro(string $nombre): ?string
{
    $v = $_GET[$nombre] ?? null;
    return is_string($v) ? $v : null;
}
