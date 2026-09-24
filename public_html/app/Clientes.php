<?php
declare(strict_types=1);

final class Clientes
{
    /** El email identifica al cliente: si ya existe se reutiliza (y se actualizan nombre y teléfono). */
    public static function obtenerOCrear(string $nombre, string $email, ?string $telefono): int
    {
        $existente = Db::uno('SELECT id FROM clientes WHERE email = ?', [$email]);
        if ($existente !== null) {
            Db::ejecutar('UPDATE clientes SET nombre = ?, telefono = ? WHERE id = ?', [$nombre, $telefono, $existente['id']]);
            return (int) $existente['id'];
        }
        return Db::insertar(
            'INSERT INTO clientes (nombre, email, telefono, creado_en) VALUES (?, ?, ?, ?)',
            [$nombre, $email, $telefono, ahora()]
        );
    }
}
