// src/lib/actions/partidas.ts
"use server";

import { db } from "@/lib/db/client";
import { usuarios, partidas, transacciones } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getTenant } from "./usuarios";

// ================================================
// LISTAR PARTIDAS DE UN USUARIO
// ================================================
export async function listarPartidas(params: {
  idToken: string;
  usuarioId: string;
}) {
  const { idToken, usuarioId } = params;
  const tenant = await getTenant(idToken);

  const usuario = await db.query.usuarios.findFirst({
    where: and(
      eq(usuarios.id, usuarioId),
      eq(usuarios.tenantId, tenant.id),
      isNull(usuarios.anuladoAt)
    ),
  });
  if (!usuario) throw new Error("Usuario no encontrado");

  const lista = await db.execute(sql`
    SELECT
      p.id,
      p.nombre,
      p.created_at as "createdAt",
      COALESCE(SUM(
        CASE WHEN t.tipo = 'PRESTAMO' THEN t.monto ELSE -t.monto END
      ) FILTER (WHERE t.anulado_at IS NULL), 0) as saldo
    FROM partidas p
    LEFT JOIN transacciones t ON t.partida_id = p.id
    WHERE p.usuario_id = ${usuarioId}
      AND p.anulado_at IS NULL
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);

  const rows = lista.rows as {
    id: string;
    nombre: string;
    createdAt: Date;
    saldo: string;
  }[];

  const saldoTotal = rows.reduce((acc, p) => acc + Number(p.saldo), 0);

  return { usuario, partidas: rows, saldoTotal };
}

// ================================================
// CREAR PARTIDA
// ================================================
export async function crearPartida(params: {
  idToken: string;
  usuarioId: string;
  nombre: string;
}) {
  const { idToken, usuarioId, nombre } = params;
  if (!nombre.trim()) throw new Error("El nombre es obligatorio");

  const tenant = await getTenant(idToken);

  const usuario = await db.query.usuarios.findFirst({
    where: and(
      eq(usuarios.id, usuarioId),
      eq(usuarios.tenantId, tenant.id),
      isNull(usuarios.anuladoAt)
    ),
  });
  if (!usuario) throw new Error("Usuario no encontrado");

  const [nueva] = await db
    .insert(partidas)
    .values({
      usuarioId,
      tenantId: tenant.id,
      nombre:   nombre.trim(),
    })
    .returning();

  return nueva;
}

// ================================================
// RENOMBRAR PARTIDA
// ================================================
export async function renombrarPartida(params: {
  idToken: string;
  partidaId: string;
  nombre: string;
}) {
  const { idToken, partidaId, nombre } = params;
  if (!nombre.trim()) throw new Error("El nombre no puede quedar vacío");

  const tenant = await getTenant(idToken);

  const [actualizada] = await db
    .update(partidas)
    .set({ nombre: nombre.trim() })
    .where(
      and(
        eq(partidas.id, partidaId),
        eq(partidas.tenantId, tenant.id),
        isNull(partidas.anuladoAt)
      )
    )
    .returning();

  if (!actualizada) throw new Error("Partida no encontrada");
  return actualizada;
}

// ================================================
// ANULAR PARTIDA (soft delete)
// ================================================
export async function anularPartida(params: {
  idToken: string;
  partidaId: string;
}) {
  const { idToken, partidaId } = params;
  const tenant = await getTenant(idToken);

  const [anulada] = await db
    .update(partidas)
    .set({ anuladoAt: new Date() })
    .where(
      and(
        eq(partidas.id, partidaId),
        eq(partidas.tenantId, tenant.id),
        isNull(partidas.anuladoAt)
      )
    )
    .returning();

  if (!anulada) throw new Error("Partida no encontrada");
  return anulada;
}