import type { JSX } from 'react';

export function App(): JSX.Element {
  return (
    <main className="app-shell">
      <section className="app-card">
        <p className="app-eyebrow">Gestión de servicios y operaciones</p>
        <h1>Nexo-ERP</h1>
        <p className="app-description">
          Esqueleto del monorepo listo. La interfaz se construirá por módulos sobre esta base.
        </p>
      </section>
    </main>
  );
}
