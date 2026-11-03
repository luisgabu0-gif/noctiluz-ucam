<?php
// Copia este archivo como config.php y rellena los datos de TU base de datos.
// config.php está en .gitignore: nunca se sube al repositorio.

return [
    'db' => [
        // 'mysql' en el hosting de DonDominio · 'sqlite' para probar en local sin MySQL
        'driver'      => 'mysql',
        'host'        => 'localhost',
        'puerto'      => 3306,
        'nombre'      => 'NOMBRE_DE_LA_BASE_DE_DATOS',
        'usuario'     => 'USUARIO_DE_LA_BASE_DE_DATOS',
        'clave'       => 'CONTRASEÑA_DE_LA_BASE_DE_DATOS',
        'sqlite_ruta' => __DIR__ . '/../datos/noctiluz.sqlite',
    ],
    // 'desarrollo' devuelve el detalle de los errores internos; 'produccion' los oculta.
    'entorno' => 'produccion',

    // Dirección pública de la tienda, sin barra final. PayPal vuelve aquí tras el pago y la usa la factura.
    'tienda' => [
        'url_publica' => 'https://noctiluz.onl',
    ],

    // PayPal en modo SANDBOX (pruebas). Credenciales de una app de developer.paypal.com → Apps & Credentials → Sandbox.
    // Nunca pongas aquí credenciales de una cuenta PayPal real ("Live").
    'paypal' => [
        'activo'    => false,
        'client_id' => 'CLIENT_ID_DE_LA_APP_SANDBOX',
        'secreto'   => 'SECRETO_DE_LA_APP_SANDBOX',
        'api'       => 'https://api-m.sandbox.paypal.com',
    ],

    // Envío de la factura por correo al pagarse un pedido.
    //   'mail'        → función mail() de PHP (el correo del hosting de DonDominio)
    //   'archivo'     → guarda cada correo como .eml en datos/correos/ (para probar en local)
    //   'desactivado' → no se envía nada (la factura se puede ver igualmente desde el pedido)
    'correo' => [
        'modo'         => 'mail',
        'remitente'    => 'facturas@noctiluz.onl',
        // Copia oculta de cada factura a una bandeja del equipo, para comprobar el envío sin usar emails reales de clientes.
        'copia_oculta' => '',
    ],
];
