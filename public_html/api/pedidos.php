<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// POST /api/pedidos.php {cliente, direccion, envio, cupon, lineas, sesion_id, acepta_condiciones} → crea el pedido
// POST /api/pedidos.php {accion: "cancelar", codigo, email}                                      → el cliente cancela un pedido sin pagar
// GET  /api/pedidos.php?codigo=...&email=...                                                     → seguimiento del pedido
permitir('GET', 'POST');

if (metodo() === 'GET') {
    $p = Pedidos::paraCliente(parametro('codigo') ?? '', parametro('email') ?? '');
    if ($p === null) {
        responder(['error' => 'No hay ningún pedido con ese código para ese email.'], 404);
    }
    responder($p);
}

$e = cuerpoJson();
if (($e['accion'] ?? null) === 'cancelar') {
    $codigo = is_string($e['codigo'] ?? null) ? $e['codigo'] : '';
    $email = is_string($e['email'] ?? null) ? $e['email'] : '';
    if (Pedidos::paraCliente($codigo, $email) === null) {
        responder(['error' => 'No hay ningún pedido con ese código para ese email.'], 404);
    }
    Db::transaccion(function () use ($codigo) {
        $p = Db::uno('SELECT * FROM pedidos WHERE codigo = ?', [$codigo]);
        if ($p['estado'] !== 'creado') {
            throw new ErrorNegocio('Solo se pueden cancelar desde la tienda los pedidos pendientes de pago. Para otros casos abre una incidencia.');
        }
        Pedidos::cambiarEstado($p, 'cancelado', 'Cancelado por el cliente antes de pagar', 'cliente');
    });
    responder(Pedidos::paraCliente($codigo, $email));
}

responder(Pedidos::crear($e), 201);
