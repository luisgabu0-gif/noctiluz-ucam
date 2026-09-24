<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// POST /api/presupuesto.php {lineas, cupon, envio} → desglose calculado en el servidor (vista previa del checkout)
permitir('POST');
$e = cuerpoJson();
$lineas = ReglasNegocio::validarLineas($e['lineas'] ?? null);
$totales = ReglasNegocio::calcular($lineas, is_string($e['cupon'] ?? null) ? $e['cupon'] : '', is_string($e['envio'] ?? null) ? $e['envio'] : 'estandar', false);
$lineasSalida = array_map(fn ($l) => [
    'sku' => $l['sku'], 'descripcion' => $l['descripcion'], 'modo' => $l['modo'], 'talla' => $l['talla'],
    'cantidad' => $l['cantidad'], 'precio' => euros($l['precio']), 'importe' => euros($l['importe']),
], $lineas);
responder(['lineas' => $lineasSalida, 'totales' => ReglasNegocio::aEuros($totales)]);
