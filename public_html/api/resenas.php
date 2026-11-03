<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// GET  /api/resenas.php → últimas reseñas, si quien mira puede opinar (el equipo no) y, con sesión de cliente, qué pedidos puede valorar
// POST /api/resenas.php {pedido, nombre, estrellas, texto, sesion_id} → publica una reseña (exige sesión de cliente; evento review.created)
permitir('GET', 'POST');
if (metodo() === 'GET') {
    $esAdmin = Resenas::esAdmin();
    $cliente = Cuentas::actual();
    responder([
        'resenas'      => Resenas::ultimas(),
        'puede_opinar' => !$esAdmin,
        'cliente'      => $cliente ? ['nombre' => $cliente['nombre']] : null,
        'pedidos'      => $cliente ? Resenas::pedidosParaOpinar((int) $cliente['id']) : [],
    ]);
}
responder(Resenas::crear(cuerpoJson()), 201);
