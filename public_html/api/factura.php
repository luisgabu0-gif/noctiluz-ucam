<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// GET /api/factura.php?codigo=…&email=… → factura en HTML (para verla o imprimirla).
// El cliente necesita el email del pedido; con la sesión del back-office iniciada no hace falta.
permitir('GET');
Admin::iniciarSesionPhp();
$email = Admin::actual() !== null ? null : (string) parametro('email');
$html = Facturas::documento((string) parametro('codigo'), $email);

header('Content-Type: text/html; charset=utf-8');
if ($html === null) {
    http_response_code(404);
    exit('<!doctype html><meta charset="utf-8"><title>Factura no encontrada</title><p>No hay ninguna factura para ese pedido y email. La factura se emite cuando el pedido está pagado.</p>');
}
echo $html;
