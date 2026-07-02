// src/lib/db/schema.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ================================================
// TENANTS
// ================================================
export const tenants = pgTable("tenants", {
  id:          uuid("id").primaryKey().defaultRandom(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  nombre:      varchar("nombre", { length: 150 }).notNull(),
  email:       varchar("email", { length: 150 }).notNull(),
  moneda:      varchar("moneda", { length: 3 }).default("USD"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ================================================
// USUARIOS
// ================================================
export const usuarios = pgTable("usuarios", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id),
  nombre:       text("nombre").notNull(),
  tokenPublico: uuid("token_publico").notNull().unique(),
  anuladoAt:    timestamp("anulado_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ================================================
// PARTIDAS
// ================================================
export const partidas = pgTable("partidas", {
  id:        uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id),
  nombre:    text("nombre").notNull(),
  anuladoAt: timestamp("anulado_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ================================================
// GRUPOS DE PRESTAMO (para cuotas generadas)
// ================================================
export const gruposPrestamo = pgTable("grupos_prestamo", {
  id:            uuid("id").primaryKey().defaultRandom(),
  partidaId:     uuid("partida_id").notNull().references(() => partidas.id),
  descripcion:   text("descripcion"),
  montoOriginal: numeric("monto_original", { precision: 12, scale: 2 }).notNull(),
  tasaAnual:     numeric("tasa_anual", { precision: 5, scale: 2 }).default("0"),
  totalCuotas:   integer("total_cuotas").notNull(),
  frecuencia:    text("frecuencia").notNull(),
  anuladoAt:     timestamp("anulado_at", { withTimezone: true }),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ================================================
// TRANSACCIONES
// ================================================
export const transacciones = pgTable("transacciones", {
  id:              uuid("id").primaryKey().defaultRandom(),
  partidaId:       uuid("partida_id").notNull().references(() => partidas.id),
  grupoId:         uuid("grupo_id").references(() => gruposPrestamo.id),
  tipo:            text("tipo").notNull(), // 'PRESTAMO' | 'PAGO'
  monto:           numeric("monto", { precision: 12, scale: 2 }).notNull(),
  descripcion:     text("descripcion"),
  fechaReferencia: date("fecha_referencia").notNull(),
  numeroCuota:     integer("numero_cuota"),
  totalCuotas:     integer("total_cuotas"),
  anuladoAt:       timestamp("anulado_at", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ================================================
// RELATIONS
// ================================================
export const tenantsRelations = relations(tenants, ({ many }) => ({
  usuarios: many(usuarios),
}));

export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
  tenant:   one(tenants, { fields: [usuarios.tenantId], references: [tenants.id] }),
  partidas: many(partidas),
}));

export const partidasRelations = relations(partidas, ({ one, many }) => ({
  usuario:        one(usuarios, { fields: [partidas.usuarioId], references: [usuarios.id] }),
  tenant:         one(tenants,  { fields: [partidas.tenantId],  references: [tenants.id] }),
  transacciones:  many(transacciones),
  gruposPrestamo: many(gruposPrestamo),
}));

export const gruposPrestamoRelations = relations(gruposPrestamo, ({ one, many }) => ({
  partida:       one(partidas, { fields: [gruposPrestamo.partidaId], references: [partidas.id] }),
  transacciones: many(transacciones),
}));

export const transaccionesRelations = relations(transacciones, ({ one }) => ({
  partida: one(partidas,       { fields: [transacciones.partidaId], references: [partidas.id] }),
  grupo:   one(gruposPrestamo, { fields: [transacciones.grupoId],   references: [gruposPrestamo.id] }),
}));