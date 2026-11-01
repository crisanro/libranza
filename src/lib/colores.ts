// src/lib/colores.ts
// Paleta de la app para los style={{}} en línea. Los valores reales viven en
// globals.css (:root); cambia un color allí y cambia en toda la app.
// También existen como clases de Tailwind: bg-fondo, text-tenue, border-acento…
export const C = {
  fondo:       "var(--fondo)",
  card:        "var(--tarjeta)",
  borde:       "var(--borde)",
  bordeSuave:  "var(--borde-suave)",
  texto:       "var(--texto)",
  marca:       "var(--marca)",
  secundario:  "var(--secundario)",
  muted:       "var(--apagado)",
  tenue:       "var(--tenue)",
  dorado:      "var(--dorado)",
  acento:      "var(--acento)",
  sobreAcento: "var(--sobre-acento)",
  alerta:      "var(--alerta)",
  overlay:     "var(--overlay)",
} as const;
