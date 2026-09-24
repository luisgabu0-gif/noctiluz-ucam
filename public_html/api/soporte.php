<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// GET  /api/soporte.php → motivos disponibles
// POST /api/soporte.php {nombre, email, motivo, mensaje, pedido?, sesion_id} → crea una incidencia (evento support.requested)
permitir('GET', 'POST');
if (metodo() === 'GET') {
    responder(['motivos' => Incidencias::MOTIVOS]);
}
responder(Incidencias::crear(cuerpoJson()), 201);
