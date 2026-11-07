import type { JSX } from 'react';

export function Clientes(): JSX.Element {
  return (
    <div className="pagina">
      <header className="pagina-header">
        <p className="app-eyebrow">Relaciones</p>
        <h2>Clientes</h2>
        <p className="app-description">
          Administración de clientes y su información de contacto.
        </p>
      </header>

      <section className="app-card placeholder-card" aria-labelledby="clientes-titulo">
        <h3 id="clientes-titulo" className="seccion-titulo">
          Módulo en preparación
        </h3>
        <p>
          El backend aún no expone endpoints de clientes. Esta página quedará conectada
          al listado real en cuanto el módulo esté disponible.
        </p>
        <ul className="lista-pendientes">
          <li>Consulta y búsqueda por documento.</li>
          <li>Datos de contacto y canal preferido.</li>
          <li>Identificación de clientes frecuentes para descuentos.</li>
        </ul>
      </section>
    </div>
  );
}
