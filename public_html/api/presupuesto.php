<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// POST /api/presupuesto.php {lineas, cupon, envio, cp?} → desglose calculado en el servidor (vista previa del checkout).
// Con un código postal de 5 cifras, los portes son los de su zona; sin él, los de la Península.
permitir('POST');
$e = cuerpoJson();
$lineas = ReglasNegocio::validarLineas($e['lineas'] ?? null);
$cp = is_string($e['cp'] ?? null) && preg_match('/^\d{5}$/', $e['cp']) ? $e['cp'] : '';
$totales = ReglasNegocio::calcular($lineas, is_string($e['cupon'] ?? null) ? $e['cupon'] : '', is_string($e['envio'] ?? null) ? $e['envio'] : 'estandar', false, $cp);
$lineasSalida = array_map(fn ($l) => [
    'sku' => $l['sku'], 'descripcion' => $l['descripcion'], 'modo' => $l['modo'], 'talla' => $l['talla'],
    'cantidad' => $l['cantidad'], 'precio' => euros($l['precio']), 'importe' => euros($l['importe']),
], $lineas);
responder(['lineas' => $lineasSalida, 'totales' => ReglasNegocio::aEuros($totales)]);
