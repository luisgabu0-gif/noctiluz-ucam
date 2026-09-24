<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// GET → listado · POST {id, estado: abierta|resuelta}
permitir('GET', 'POST');
Admin::exigir();
if (metodo() === 'POST') {
    Incidencias::cambiarEstado(cuerpoJson());
}
responder(['incidencias' => Incidencias::listar()]);
