//src/lib/fechas.ts
export function obtenerFechaMovimiento(c: {
  fechaVencimiento: Date | null;
  createdAt: Date | null;
}): Date {
  return new Date(c.fechaVencimiento ?? c.createdAt ?? new Date());
}

export function claveSemana(fecha: Date): string {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
  const lunes = new Date(d.setDate(diff));
  return lunes.toISOString().slice(0, 10);
}

export function etiquetaSemana(claveLunes: string): string {
  const lunes = new Date(claveLunes + "T00:00:00");
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);

  const formato = (d: Date) =>
    d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });

  return `${formato(lunes)} - ${formato(domingo)}`;
}

export function claveMes(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

export function etiquetaMes(claveYYYYMM: string): string {
  const [anio, mes] = claveYYYYMM.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, 1);
  const texto = fecha.toLocaleDateString("es-EC", {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatoFechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
