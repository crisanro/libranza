"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { crearTenant } from "@/lib/actions/usuarios";

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credencial = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await crearTenant({
        firebaseUid: credencial.user.uid,
        nombre: nombre.trim(),
        email,
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;

      if (code === "auth/email-already-in-use") {
        setError("Ese correo ya está registrado. Intenta iniciar sesión.");
      } else if (code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else if (code === "auth/invalid-email") {
        setError("El correo no es válido.");
      } else {
        setError("Ocurrió un error al registrarte. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div
        className="w-full max-w-sm rounded-2xl border p-8"
        style={{
          backgroundColor: "#221C15",
          borderColor: "rgba(201, 184, 150, 0.12)",
        }}
      >
        <h1
          className="text-xl"
          style={{ fontFamily: "var(--font-fraunces)", color: "#EDE3CE" }}
        >
          Abre tu cuenta
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#8C826F" }}>
          Empieza a llevar tus cobros y deudas en un solo lugar.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="nombre"
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "#A89B81" }}
            >
              Nombre
            </label>
            <input
              id="nombre"
              type="text"
              placeholder="Tu nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                borderColor: "rgba(201, 184, 150, 0.18)",
                color: "#EDE3CE",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7A9B6E")}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor =
                  "rgba(201, 184, 150, 0.18)")
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "#A89B81" }}
            >
              Correo
            </label>
            <input
              id="email"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                borderColor: "rgba(201, 184, 150, 0.18)",
                color: "#EDE3CE",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7A9B6E")}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor =
                  "rgba(201, 184, 150, 0.18)")
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "#A89B81" }}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                borderColor: "rgba(201, 184, 150, 0.18)",
                color: "#EDE3CE",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7A9B6E")}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor =
                  "rgba(201, 184, 150, 0.18)")
              }
            />
          </div>

          {error && (
            <p className="text-sm" role="alert" style={{ color: "#D08B6A" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg py-2.5 text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "#7A9B6E", color: "#171510" }}
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "#8C826F" }}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="underline" style={{ color: "#C9B896" }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
