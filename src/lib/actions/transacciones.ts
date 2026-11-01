// src/lib/actions/transacciones.ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { partidas, gruposPrestamo, transacciones } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getTenant } from "@/lib/tenant";
import * as v from "@/lib/validacion";

// ================================================
// HELPER: verificar que la partida pertenece al tenant
// ================================================
async function getPartida(tenantId: string, partidaId: string) {
  const partida = await db.query.partidas.findFirst({
    where: and(
      eq(partidas.id, partidaId),
      eq(partidas.tenantId, tenantId),
      isNull(partidas.anuladoAt)
    ),
  });
  if (!partida) throw new Error("Partida no encontrada");
  return partida;
}

// ================================================
// LISTAR TRANSACCIONES DE UNA PARTIDA
// ================================================
const esquemaListar = z.object({
  idToken:   v.idToken,
  partidaId: v.id,
});

export async function listarTransacciones(params: {
  idToken: string;
  partidaId: string;
}) {
  const { idToken, partidaId } = v.validar(esquemaListar, params);
  const tenant = await getTenant(idToken);
  await getPartida(tenant.id, partidaId);

  const lista = await db.query.transacciones.findMany({
    where: and(
      eq(transacciones.partidaId, partidaId),
      isNull(transacciones.anuladoAt)
    ),
    orderBy: [desc(transacciones.fechaReferencia), desc(transacciones.createdAt)],
  });

  const saldo = lista.reduce((acc, t) => {
    return t.tipo === "PRESTAMO"
      ? acc + Number(t.monto)
      : acc - Number(t.monto);
  }, 0);

  return { transacciones: lista, saldo };
}

// ================================================
// AGREGAR TRANSACCION SIMPLE (pago o prestamo sin cuotas)
// ================================================
const esquemaAgregar = z.object({
  idToken:         v.idToken,
  partidaId:       v.id,
  tipo:            v.tipoTransaccion,
  monto:           v.monto,
  descripcion:     v.descripcion,
  fechaReferencia: v.fecha,
});

export async function agregarTransaccion(params: {
  idToken: string;
  partidaId: string;
  tipo: "PRESTAMO" | "PAGO";
  monto: number;
  descripcion: string;
  fechaReferencia: string;
}) {
  const { idToken, partidaId, tipo, monto, descripcion, fechaReferencia } =
    v.validar(esquemaAgregar, params);

  const tenant = await getTenant(idToken);
  await getPartida(tenant.id, partidaId);

  const [nueva] = await db
    .insert(transacciones)
    .values({
      partidaId,
      tipo,
      monto:           monto.toFixed(2),
      descripcion:     descripcion || null,
      fechaReferencia, // date string YYYY-MM-DD
    })
    .returning();

  return nueva;
}

// ================================================
// AGREGAR PRESTAMO CON CUOTAS (sistema frances)
// ================================================
const esquemaAmortizacion = z.object({
  montoOriginal: v.monto,
  tasaAnual:     v.tasaAnual,
  totalCuotas:   v.totalCuotas,
  frecuencia:    v.frecuencia,
  fechaInicio:   v.fecha,
});

const esquemaPrestamoCuotas = esquemaAmortizacion.extend({
  idToken:     v.idToken,
  partidaId:   v.id,
  descripcion: v.descripcion,
});

export async function agregarPrestamoCuotas(params: {
  idToken: string;
  partidaId: string;
  descripcion: string;
  montoOriginal: number;
  tasaAnual: number;
  totalCuotas: number;
  frecuencia: "DIARIO" | "SEMANAL" | "QUINCENAL" | "MENSUAL" | "AL_VENCIMIENTO";
  fechaInicio: string;
}) {
  const {
    idToken,
    partidaId,
    descripcion,
    montoOriginal,
    tasaAnual,
    totalCuotas,
    frecuencia,
    fechaInicio,
  } = v.validar(esquemaPrestamoCuotas, params);

  const tenant = await getTenant(idToken);
  await getPartida(tenant.id, partidaId);

  // Calcular tabla de amortización francesa
  const filas = calcularAmortizacion({
    monto: montoOriginal,
    tasaAnual,
    totalCuotas,
    frecuencia,
    fechaInicio,
  });

  // Grupo y cuotas se guardan juntos o no se guarda nada
  return db.transaction(async (tx) => {
    const [grupo] = await tx
      .insert(gruposPrestamo)
      .values({
        partidaId,
        descripcion:   descripcion || null,
        montoOriginal: montoOriginal.toFixed(2),
        tasaAnual:     tasaAnual.toFixed(2),
        totalCuotas,
        frecuencia,
      })
      .returning();

    await tx.insert(transacciones).values(
      filas.map((f) => ({
        partidaId,
        grupoId:         grupo.id,
        tipo:            "PRESTAMO" as const,
        monto:           f.cuota.toFixed(2),
        descripcion:     `${descripcion ? descripcion + " - " : ""}Cuota ${f.numero}/${totalCuotas}`,
        fechaReferencia: f.fecha,
        numeroCuota:     f.numero,
        totalCuotas,
      }))
    );

    return { grupo, cuotas: filas.length };
  });
}

// ================================================
// ANULAR TRANSACCION SIMPLE
// ================================================
const esquemaAnularTransaccion = z.object({
  idToken:       v.idToken,
  transaccionId: v.id,
});

export async function anularTransaccion(params: {
  idToken: string;
  transaccionId: string;
}) {
  const { idToken, transaccionId } = v.validar(esquemaAnularTransaccion, params);
  const tenant = await getTenant(idToken);

  const transaccion = await db.query.transacciones.findFirst({
    where: and(
      eq(transacciones.id, transaccionId),
      isNull(transacciones.anuladoAt)
    ),
    with: { partida: true },
  });

  if (!transaccion) throw new Error("Transacción no encontrada");
  if (transaccion.partida.tenantId !== tenant.id) throw new Error("Sin acceso");
  if (transaccion.grupoId) throw new Error("Esta cuota pertenece a un grupo, anula el grupo completo");

  // Verificar 5 minutos
  const createdAt = new Date(transaccion.createdAt!);
  const diffMs = Date.now() - createdAt.getTime();
  if (diffMs > 5 * 60 * 1000) {
    throw new Error("Solo puedes anular transacciones en los primeros 5 minutos de creadas");
  }

  const [anulada] = await db
    .update(transacciones)
    .set({ anuladoAt: new Date() })
    .where(eq(transacciones.id, transaccionId))
    .returning();

  return anulada;
}

const esquemaAnularGrupo = z.object({
  idToken: v.idToken,
  grupoId: v.id,
});

export async function anularGrupo(params: {
  idToken: string;
  grupoId: string;
}) {
  const { idToken, grupoId } = v.validar(esquemaAnularGrupo, params);
  const tenant = await getTenant(idToken);

  const grupo = await db.query.gruposPrestamo.findFirst({
    where: and(
      eq(gruposPrestamo.id, grupoId),
      isNull(gruposPrestamo.anuladoAt)
    ),
    with: { partida: true },
  });

  if (!grupo) throw new Error("Grupo no encontrado");
  if (grupo.partida.tenantId !== tenant.id) throw new Error("Sin acceso");

  // Verificar 5 minutos
  const createdAt = new Date(grupo.createdAt!);
  const diffMs = Date.now() - createdAt.getTime();
  if (diffMs > 5 * 60 * 1000) {
    throw new Error("Solo puedes anular grupos en los primeros 5 minutos de creados");
  }

  // Cuotas y grupo se anulan juntos o no se anula nada
  return db.transaction(async (tx) => {
    await tx
      .update(transacciones)
      .set({ anuladoAt: new Date() })
      .where(and(
        eq(transacciones.grupoId, grupoId),
        isNull(transacciones.anuladoAt)
      ));

    const [anulado] = await tx
      .update(gruposPrestamo)
      .set({ anuladoAt: new Date() })
      .where(eq(gruposPrestamo.id, grupoId))
      .returning();

    return anulado;
  });
}

// ================================================
// SIMULAR AMORTIZACION (sin guardar, para preview)
// ================================================
const esquemaSimular = esquemaAmortizacion.extend({
  idToken: v.idToken,
});

export async function simularAmortizacion(params: {
  idToken: string;
  montoOriginal: number;
  tasaAnual: number;
  totalCuotas: number;
  frecuencia: "DIARIO" | "SEMANAL" | "QUINCENAL" | "MENSUAL" | "AL_VENCIMIENTO";
  fechaInicio: string;
}) {
  const { idToken, ...datos } = v.validar(esquemaSimular, params);
  await getTenant(idToken);

  const filas = calcularAmortizacion({
    monto:       datos.montoOriginal,
    tasaAnual:   datos.tasaAnual,
    totalCuotas: datos.totalCuotas,
    frecuencia:  datos.frecuencia,
    fechaInicio: datos.fechaInicio,
  });
  const totalIntereses = filas.reduce((acc, f) => acc + f.interes, 0);
  return {
    filas,
    cuotaFija:      filas[0]?.cuota ?? 0,
    totalIntereses: Math.round(totalIntereses * 100) / 100,
  };
}
// ================================================
// CALCULO DE AMORTIZACION FRANCESA (interno)
// ================================================
type Frecuencia = "DIARIO" | "SEMANAL" | "QUINCENAL" | "MENSUAL" | "AL_VENCIMIENTO";

interface FilaAmortizacion {
  numero:        number;
  fecha:         string;
  cuota:         number;
  capital:       number;
  interes:       number;
  saldoRestante: number;
}

function tasaPeriodica(tasaAnual: number, frecuencia: Frecuencia): number {
  const ta = tasaAnual / 100;
  switch (frecuencia) {
    case "DIARIO":        return ta / 365;
    case "SEMANAL":       return ta / 52;
    case "QUINCENAL":     return ta / 24;
    case "MENSUAL":       return ta / 12;
    case "AL_VENCIMIENTO": return ta;
  }
}

function siguienteFecha(anio: number, mes: number, dia: number, frecuencia: Frecuencia): { anio: number; mes: number; dia: number } {
  switch (frecuencia) {
    case "DIARIO": {
      const d = new Date(anio, mes - 1, dia + 1);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
    }
    case "SEMANAL": {
      const d = new Date(anio, mes - 1, dia + 7);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
    }
    case "QUINCENAL": {
      const d = new Date(anio, mes - 1, dia + 15);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
    }
    case "MENSUAL": {
      let nuevoMes = mes + 1;
      let nuevoAnio = anio;
      if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio++; }
      // Último día del nuevo mes
      const ultimoDia = new Date(nuevoAnio, nuevoMes, 0).getDate();
      return { anio: nuevoAnio, mes: nuevoMes, dia: Math.min(dia, ultimoDia) };
    }
    case "AL_VENCIMIENTO":
      return { anio, mes, dia };
  }
}

function formatFecha(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function calcularAmortizacion(params: {
  monto: number;
  tasaAnual: number;
  totalCuotas: number;
  frecuencia: Frecuencia;
  fechaInicio: string;
}): FilaAmortizacion[] {
  const { monto, tasaAnual, totalCuotas, frecuencia, fechaInicio } = params;

  const i = tasaPeriodica(tasaAnual, frecuencia);
  const cuotaFija = i === 0
    ? monto / totalCuotas
    : (monto * i) / (1 - Math.pow(1 + i, -totalCuotas));

  let saldo = monto;
  const filas: FilaAmortizacion[] = [];

  // Parsear fecha sin timezone
  const [anioI, mesI, diaI] = fechaInicio.split("-").map(Number);
  let current = { anio: anioI, mes: mesI, dia: diaI };

  for (let n = 1; n <= totalCuotas; n++) {
    const interes  = Math.round(saldo * i * 100) / 100;
    let capital    = Math.round((cuotaFija - interes) * 100) / 100;
    let cuota      = Math.round(cuotaFija * 100) / 100;

    if (n === totalCuotas) {
      capital = Math.round(saldo * 100) / 100;
      cuota   = Math.round((capital + interes) * 100) / 100;
    }

    saldo = Math.round((saldo - capital) * 100) / 100;

    filas.push({
      numero:        n,
      fecha:         formatFecha(current.anio, current.mes, current.dia),
      cuota,
      capital,
      interes,
      saldoRestante: Math.max(saldo, 0),
    });

    if (n < totalCuotas) {
      current = siguienteFecha(current.anio, current.mes, current.dia, frecuencia);
    }
  }

  return filas;
}