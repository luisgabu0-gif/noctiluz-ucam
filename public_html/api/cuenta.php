<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// GET    /api/cuenta.php → cliente con sesión iniciada (o null), con sus pedidos e incidencias
// POST   /api/cuenta.php {accion: "registro", nombre, email, clave, sesion_id} → crea la cuenta e inicia sesión (evento customer.registered)
// POST   /api/cuenta.php {accion: "login", email, clave}                       → inicia sesión
// DELETE /api/cuenta.php → cierra la sesión
permitir('GET', 'POST', 'DELETE');

if (metodo() === 'DELETE') {
    Cuentas::logout();
    responder(['ok' => true]);
}
if (metodo() === 'POST') {
    $e = cuerpoJson();
    $cliente = ($e['accion'] ?? '') === 'registro' ? Cuentas::registrar($e) : Cuentas::login($e);
    responder(Cuentas::resumen($cliente));
}
$cliente = Cuentas::actual();
responder($cliente ? Cuentas::resumen($cliente) : ['cliente' => null]);
