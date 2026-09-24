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
];
