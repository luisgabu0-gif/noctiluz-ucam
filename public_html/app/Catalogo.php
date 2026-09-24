<?php
declare(strict_types=1);

/** Datos maestros del catálogo: productos, variantes (SKU), categorías, colores y modos. */
final class Catalogo
{
    public static function listar(): array
    {
        $productos = Db::todos(
            'SELECT p.id, p.slug, p.nombre, p.categoria_id, c.nombre_singular AS categoria_nombre,
                    p.descripcion, p.material, p.autonomia_h, p.precio, p.tiene_tallas, p.valoracion, p.num_resenas
               FROM productos p JOIN categorias c ON c.id = p.categoria_id
              WHERE p.activo = 1
              ORDER BY c.orden, p.id'
        );

        $modosPorProducto = [];
        foreach (Db::todos('SELECT producto_id, modo_id FROM producto_modos ORDER BY modo_id') as $f) {
            $modosPorProducto[(int) $f['producto_id']][] = $f['modo_id'];
        }

        $variantesPorProducto = [];
        $variantes = Db::todos(
            'SELECT v.producto_id, v.sku, v.color_id, col.nombre AS color_nombre, col.hex, v.imagen, v.stock
               FROM variantes v JOIN colores col ON col.id = v.color_id
              ORDER BY v.id'
        );
        foreach ($variantes as $v) {
            $variantesPorProducto[(int) $v['producto_id']][] = [
                'sku'          => $v['sku'],
                'color'        => $v['color_id'],
                'color_nombre' => $v['color_nombre'],
                'hex'          => $v['hex'],
                'imagen'       => $v['imagen'],
                'stock'        => (int) $v['stock'],
            ];
        }

        $salida = [];
        foreach ($productos as $p) {
            $id = (int) $p['id'];
            $salida[] = [
                'slug'             => $p['slug'],
                'nombre'           => $p['nombre'],
                'categoria'        => $p['categoria_id'],
                'categoria_nombre' => $p['categoria_nombre'],
                'descripcion'      => $p['descripcion'],
                'material'         => $p['material'],
                'autonomia_h'      => (int) $p['autonomia_h'],
                'precio'           => (float) $p['precio'],
                'tiene_tallas'     => (bool) $p['tiene_tallas'],
                'valoracion'       => (float) $p['valoracion'],
                'num_resenas'      => (int) $p['num_resenas'],
                'modos'            => $modosPorProducto[$id] ?? [],
                'variantes'        => $variantesPorProducto[$id] ?? [],
            ];
        }

        return [
            'productos'  => $salida,
            'categorias' => Db::todos('SELECT id, nombre, nombre_singular FROM categorias ORDER BY orden'),
            'colores'    => Db::todos('SELECT id, nombre, hex FROM colores'),
            'modos'      => Db::todos('SELECT id, nombre, descripcion FROM modos'),
            'tallas'     => ReglasNegocio::TALLAS,
            'reglas'     => [
                'iva'                 => ReglasNegocio::IVA_PORCENTAJE,
                'envio_estandar'      => euros(ReglasNegocio::ENVIO_ESTANDAR),
                'envio_expres'        => euros(ReglasNegocio::ENVIO_EXPRES),
                'umbral_envio_gratis' => euros(ReglasNegocio::UMBRAL_ENVIO_GRATIS),
                'max_unidades_linea'  => ReglasNegocio::MAX_UNIDADES_LINEA,
            ],
        ];
    }

    /** Variante lista para comprar (precio y modos salen SIEMPRE de la base de datos, nunca del navegador). */
    public static function variante(string $sku): ?array
    {
        $v = Db::uno(
            'SELECT v.id AS variante_id, v.sku, v.stock, v.color_id, col.nombre AS color_nombre,
                    p.id AS producto_id, p.nombre, p.precio, p.tiene_tallas
               FROM variantes v
               JOIN productos p ON p.id = v.producto_id
               JOIN colores col ON col.id = v.color_id
              WHERE v.sku = ? AND p.activo = 1',
            [$sku]
        );
        if ($v === null) {
            return null;
        }
        $v['modos'] = array_column(Db::todos('SELECT modo_id FROM producto_modos WHERE producto_id = ?', [$v['producto_id']]), 'modo_id');
        return $v;
    }
}
