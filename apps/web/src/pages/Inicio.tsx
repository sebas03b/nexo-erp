import type { JSX } from 'react';

export function Inicio(): JSX.Element {
  return (
    <section className="inicio-pagina" aria-label="Inicio">
      <h1 className="inicio-titulo">Bienvenido/a</h1>
      <p className="inicio-instruccion">selecciona un módulo para iniciar</p>
    </section>
  );
}
