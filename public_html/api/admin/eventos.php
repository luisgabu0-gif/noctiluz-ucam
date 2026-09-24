<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// GET ?tipo=&desde_id=0&limite=200            → eventos en JSON, ordenados por id (lectura incremental por cursor)
// GET ?formato=csv | ?formato=json&descargar=1 → exportación completa para otro sistema (Tarea 2)
permitir('GET');
Admin::exigir();

$tipo = parametro('tipo');
$desde = max(0, (int) (parametro('desde_id') ?? 0));
$limite = (int) (parametro('limite') ?? 200);
$formato = parametro('formato') ?? 'json';

$eventos = Eventos::listar($tipo, $desde, $formato === 'json' && !parametro('descargar') ? $limite : 1000);

if ($formato === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="noctiluz-eventos-' . date('Ymd-His') . '.csv"');
    $salida = fopen('php://output', 'w');
    fwrite($salida, "\xEF\xBB\xBF"); // BOM para que Excel respete las tildes
    fputcsv($salida, ['id', 'uuid', 'tipo', 'origen', 'ocurrido_en', 'sesion_id', 'cliente_id', 'pedido_codigo', 'datos'], ';');
    foreach ($eventos as $ev) {
        fputcsv($salida, [
            $ev['id'], $ev['uuid'], $ev['tipo'], $ev['origen'], $ev['ocurrido_en'], $ev['sesion_id'],
            $ev['cliente_id'], $ev['pedido_codigo'], json_encode($ev['datos'], JSON_UNESCAPED_UNICODE),
        ], ';');
    }
    exit;
}

if (parametro('descargar')) {
    header('Content-Disposition: attachment; filename="noctiluz-eventos-' . date('Ymd-His') . '.json"');
}
$ultimo = $eventos ? end($eventos)['id'] : $desde;
responder(['eventos' => $eventos, 'siguiente_desde_id' => $ultimo, 'tipos' => array_merge(Eventos::TIPOS_CLIENTE, Eventos::TIPOS_SERVIDOR)]);
