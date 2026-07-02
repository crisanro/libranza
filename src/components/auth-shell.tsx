//src/components/auth-shell.tsx
import { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ backgroundColor: "#191510" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent, transparent 27px, #C9B896 27px, #C9B896 28px)",
        }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: "#7A9B6E" }}
      />

      <div className="relative z-10 flex w-full flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <span
            className="text-3xl italic"
            style={{
              fontFamily: "var(--font-fraunces)",
              color: "#E7DCC4",
            }}
          >
            Libranza
          </span>
          <span
            className="text-xs uppercase tracking-[0.2em]"
            style={{ color: "#8C826F" }}
          >
            Cobros, pagos y deudas
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
