<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// POST {version, codigo, estado, motivo, origen} → n8n lleva a la tienda un cambio de estado hecho en el back-office.
// Respuestas en docs/contrato_integracion.md, apartado 6.
permitir('POST');
Integracion::exigirToken();
responder(Integracion::aplicarEstado(cuerpoJson()));
