// src/lib/actions/usuarios.ts
"use server";

import { db } from "@/lib/db/client";
import { tenants, usuarios, transacciones, partidas } from "@/lib/db/schema";
import { eq, ilike, and, desc, asc, sql, isNull } from "drizzle-orm";
import { adminAuth } from "@/lib/firebase/admin";

// ================================================
// HELPER: obtener tenant desde firebase token
// ================================================
export async function getTenant(idToken: string) {
  const decoded = await adminAuth.verifyIdToken(idToken);
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.firebaseUid, decoded.uid),
  });
  if (!tenant) throw new Error("Tenant no encontrado");
  return tenant;
}

export type OrdenUsuarios =
  | "nombre_asc"
  | "creado_desc"
  | "creado_asc"
  | "ultimo_movimiento_desc";

// ================================================
// LISTAR USUARIOS
// ================================================
export async function listarUsuarios(params: {
  idToken: string;
  busqueda?: string;
  cursor?: number;
  limite?: number;
  orden?: OrdenUsuarios;
}) {
  const {
    idToken,
    busqueda = "",
    cursor = 0,
    limite = 15,
    orden = "creado_desc",
  } = params;

  const tenant = await getTenant(idToken);
  const tenantId = tenant.id;

  const condiciones = [
    eq(usuarios.tenantId, tenant.id),
    isNull(usuarios.anuladoAt),
  ];

  if (busqueda.trim()) {
    condiciones.push(ilike(usuarios.nombre, `%${busqueda.trim()}%`));
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
      WHERE u.tenant_id = ${condiciones[0] ? sql`${tenantId}` : sql`${tenantId}`}
        AND u.anulado_at IS NULL
        ${busqueda.trim() ? sql`AND u.nombre ILIKE ${'%' + busqueda.trim() + '%'}` : sql``}
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
export async function crearUsuario(params: {
  idToken: string;
  nombre: string;
}) {
  const { idToken, nombre } = params;
  if (!nombre.trim()) throw new Error("El nombre es obligatorio");

  const tenant = await getTenant(idToken);

  const [nuevo] = await db
    .insert(usuarios)
    .values({
      tenantId:     tenant.id,
      nombre:       nombre.trim(),
      tokenPublico: crypto.randomUUID(),
    })
    .returning();

  return nuevo;
}