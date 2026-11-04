<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// GET                             → estado de la cola de envíos a n8n
// POST {accion: "procesar"}       → envía ya lo que esté vencido (lo llama el flujo programado de n8n)
// POST {accion: "reenviar", id}   → vuelve a poner en cola un envío fallido
permitir('GET', 'POST');
Integracion::exigirToken();

if (metodo() === 'GET') {
    responder(Integracion::estadoCola());
}
$e = cuerpoJson();
if (($e['accion'] ?? null) === 'reenviar') {
    Integracion::reenviar($e['id'] ?? null);
    responder(['ok' => true]);
}
responder(['ok' => true] + Integracion::procesar(20));
