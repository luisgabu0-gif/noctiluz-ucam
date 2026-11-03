<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// GET ?estado=&q=      → listado de pedidos
// GET ?codigo=...      → detalle con líneas, pagos e historial
// POST {codigo, estado, motivo} → cambio de estado (respeta la máquina de estados)
// POST {accion: "reenviar_factura", codigo} → vuelve a enviar por correo la factura de un pedido pagado
permitir('GET', 'POST');
$admin = Admin::exigir();

if (metodo() === 'POST') {
    $e = cuerpoJson();
    if (($e['accion'] ?? '') === 'reenviar_factura') {
        $codigo = is_string($e['codigo'] ?? null) ? $e['codigo'] : '';
        Facturas::enviar($codigo);
        responder(Pedidos::detalle($codigo));
    }
    responder(Pedidos::cambiarEstadoAdmin($e, $admin['email']));
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
