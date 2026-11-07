import type { JSX } from 'react';

import { useCatalogo } from '../hooks/useCatalogo';
import { formatearMoneda } from '../lib/formato';
import { claseStock } from '../lib/stock';

export function Productos(): JSX.Element {
  const { productos, stock, cargando, error, recargar } = useCatalogo();

  return (
    <div className="pagina">
      <header className="pagina-header pagina-header-con-accion">
        <div>
          <p className="app-eyebrow">Inventario</p>
          <h2>Productos y Stock</h2>
          <p className="app-description">
            Catálogo disponible y existencias registradas para cada producto.
          </p>
        </div>

        <button
          type="button"
          className="boton-secundario"
          onClick={recargar}
          disabled={cargando}
        >
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      ) : null}

      <section className="app-card" aria-labelledby="inventario-titulo">
        <h3 id="inventario-titulo" className="seccion-titulo">
          Inventario
        </h3>

        {cargando ? (
          <p className="app-empty">Cargando productos…</p>
        ) : productos.length === 0 ? (
          <p className="app-empty">No hay productos registrados.</p>
        ) : (
          <div className="tabla-contenedor">
            <table className="productos-tabla">
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Stock</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto) => {
                  const cantidad = stock[producto.id] ?? 0;

                  return (
                    <tr key={producto.id}>
                      <td>{producto.sku}</td>
                      <td>{producto.nombre}</td>
                      <td>{producto.tipo}</td>
                      <td>{formatearMoneda(producto.precio)}</td>
                      <td>
                        <span className={`stock-badge ${claseStock(cantidad)}`}>
                          {cantidad}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
