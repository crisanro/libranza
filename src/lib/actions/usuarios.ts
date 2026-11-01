// src/lib/actions/usuarios.ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { usuarios } from "@/lib/db/schema";
import { eq, ilike, and, desc, asc, sql, isNull } from "drizzle-orm";
import { getTenant } from "@/lib/tenant";
import * as v from "@/lib/validacion";

export type OrdenUsuarios = (typeof v.ORDENES_USUARIOS)[number];

// Escapa los comodines de LIKE para que la búsqueda sea literal
function patronBusqueda(texto: string) {
  return `%${texto.replace(/[\\%_]/g, "\\$&")}%`;
}

// ================================================
// LISTAR USUARIOS
// ================================================
const esquemaListar = z.object({
  idToken:  v.idToken,
  busqueda: z.string().trim().max(100).default(""),
  cursor:   z.number().int().min(0).max(100_000).default(0),
  limite:   z.number().int().min(1).max(50).default(15),
  orden:    z.enum(v.ORDENES_USUARIOS).default("creado_desc"),
});

export async function listarUsuarios(params: {
  idToken: string;
  busqueda?: string;
  cursor?: number;
  limite?: number;
  orden?: OrdenUsuarios;
}) {
  const { idToken, busqueda, cursor, limite, orden } = v.validar(esquemaListar, params);

  const tenant = await getTenant(idToken);

  const condiciones = [
    eq(usuarios.tenantId, tenant.id),
    isNull(usuarios.anuladoAt),
  ];

  if (busqueda) {
    condiciones.push(ilike(usuarios.nombre, patronBusqueda(busqueda)));
  }

  if (orden === "ultimo_movimiento_desc") {
    const resultados = await db.execute(sql`
      SELECT
        u.id,
        u.nombre,
        u.token_publico as "tokenPublico",
        u.created_at as "createdAt",
        (
          SELECT MAX(t.created_at)
          FROM transacciones t
          INNER JOIN partidas p ON p.id = t.partida_id
          WHERE p.usuario_id = u.id
            AND t.anulado_at IS NULL
        ) as "ultimoMovimiento"
      FROM usuarios u
      WHERE u.tenant_id = ${tenant.id}
        AND u.anulado_at IS NULL
        ${busqueda ? sql`AND u.nombre ILIKE ${patronBusqueda(busqueda)}` : sql``}
      ORDER BY "ultimoMovimiento" DESC NULLS LAST
      LIMIT ${limite}
      OFFSET ${cursor}
    `);

    const rows = resultados.rows as {
      id: string;
      nombre: string;
      tokenPublico: string;
      createdAt: Date;
      ultimoMovimiento: Date | null;
    }[];

    return {
      usuarios: rows,
      siguienteCursor: rows.length === limite ? cursor + limite : null,
    };
  }

  const ordenColumna =
    orden === "nombre_asc"
      ? [asc(usuarios.nombre)]
      : orden === "creado_asc"
        ? [asc(usuarios.createdAt)]
        : [desc(usuarios.createdAt)];

  const resultados = await db.query.usuarios.findMany({
    where: and(...condiciones),
    orderBy: ordenColumna,
    limit: limite,
    offset: cursor,
  });

  return {
    usuarios: resultados,
    siguienteCursor: resultados.length === limite ? cursor + limite : null,
  };
}

// ================================================
// CREAR USUARIO
// ================================================
const esquemaCrearUsuario = z.object({
  idToken: v.idToken,
  nombre:  v.nombre,
});

export async function crearUsuario(params: {
  idToken: string;
  nombre: string;
}) {
  const { idToken, nombre } = v.validar(esquemaCrearUsuario, params);

  const tenant = await getTenant(idToken);

  const [nuevo] = await db
    .insert(usuarios)
    .values({
      tenantId:     tenant.id,
      nombre,
      tokenPublico: crypto.randomUUID(),
    })
    .returning();

  return nuevo;
}
