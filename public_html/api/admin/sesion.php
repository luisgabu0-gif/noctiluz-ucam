<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// GET → sesión actual · POST {email, clave} → iniciar sesión · DELETE → cerrar sesión
permitir('GET', 'POST', 'DELETE');
if (metodo() === 'POST') {
    responder(['admin' => Admin::login(cuerpoJson())]);
}
if (metodo() === 'DELETE') {
    Admin::logout();
    responder(['ok' => true]);
}
responder(['admin' => Admin::actual()]);
