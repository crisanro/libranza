// src/lib/tenant.ts
// Helpers de autenticación de uso interno del servidor. Viven fuera de los
// archivos "use server" para que no queden expuestos como server actions.
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { adminAuth } from "@/lib/firebase/admin";
import { idToken as esquemaIdToken, validar } from "@/lib/validacion";

// App de uso personal: solo los correos de ALLOWED_EMAILS (separados por
// coma) pueden usarla. Si la variable falta, no entra nadie.
const correosPermitidos = new Set(
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((correo) => correo.trim().toLowerCase())
    .filter(Boolean)
);

if (correosPermitidos.size === 0) {
  console.error("ALLOWED_EMAILS está vacío: ninguna cuenta podrá entrar");
}

// ================================================
// HELPER: verificar el token de Firebase
// ================================================
async function verificarToken(idToken: unknown) {
  const token = validar(esquemaIdToken, idToken);
  const decoded = await adminAuth.verifyIdToken(token);
  const email = decoded.email?.toLowerCase();
  if (!email || !correosPermitidos.has(email)) throw new Error("Sin acceso");
  return decoded;
}

// ================================================
// HELPER: obtener tenant desde firebase token
// ================================================
export async function getTenant(idToken: unknown) {
  const decoded = await verificarToken(idToken);
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.firebaseUid, decoded.uid),
  });
  if (!tenant) throw new Error("Tenant no encontrado");
  return tenant;
}
