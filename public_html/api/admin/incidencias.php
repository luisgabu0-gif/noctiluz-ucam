<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// GET    → listado y motivos posibles
// POST   {id, estado: abierta|resuelta}                       → marcar resuelta / reabrir
// POST   {accion: "editar", id, motivo, mensaje, estado}      → modificar (evento support.updated)
// POST   {accion: "responder", id, respuesta}                 → responder al cliente (evento support.replied)
// DELETE ?id=N                                                → eliminar (evento support.deleted)
permitir('GET', 'POST', 'DELETE');
$admin = Admin::exigir();
if (metodo() === 'DELETE') {
    Incidencias::eliminar(parametro('id'), $admin['email']);
}
if (metodo() === 'POST') {
    $e = cuerpoJson();
    match ($e['accion'] ?? '') {
        'editar'    => Incidencias::editar($e, $admin['email']),
        'responder' => Incidencias::responder($e, $admin['email']),
        default     => Incidencias::cambiarEstado($e),
    };
}
responder(['incidencias' => Incidencias::listar(), 'motivos' => Incidencias::MOTIVOS]);
