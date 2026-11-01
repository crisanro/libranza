-- Tabla exclusiva para el keepalive de Supabase. No la usa la app.
CREATE TABLE IF NOT EXISTS keepalive (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  valor        integer     NOT NULL,
  ejecutado_at timestamptz NOT NULL DEFAULT now()
);

-- Supabase expone el esquema public por su API REST: sin políticas, nadie
-- con la anon key puede leerla ni escribirla (el dueño de la tabla sí).
ALTER TABLE keepalive ENABLE ROW LEVEL SECURITY;

INSERT INTO keepalive (valor) VALUES (1);

-- No acumular filas para siempre
DELETE FROM keepalive WHERE ejecutado_at < now() - interval '180 days';

SELECT count(*)          AS ejecuciones,
       sum(valor)        AS suma,
       max(ejecutado_at) AS ultima
FROM keepalive;
