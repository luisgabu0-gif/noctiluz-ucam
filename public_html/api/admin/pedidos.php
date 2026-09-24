<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// GET ?estado=&q=      → listado de pedidos
// GET ?codigo=...      → detalle con líneas, pagos e historial
// POST {codigo, estado, motivo} → cambio de estado (respeta la máquina de estados)
permitir('GET', 'POST');
$admin = Admin::exigir();

if (metodo() === 'POST') {
    responder(Pedidos::cambiarEstadoAdmin(cuerpoJson(), $admin['email']));
}
$codigo = parametro('codigo');
if ($codigo !== null) {
    $p = Pedidos::detalle($codigo);
    if ($p === null) {
        responder(['error' => 'Pedido no encontrado.'], 404);
    }
    responder($p);
}
responder(['pedidos' => Pedidos::listar(parametro('estado'), parametro('q')), 'estados' => ReglasNegocio::ESTADOS]);
