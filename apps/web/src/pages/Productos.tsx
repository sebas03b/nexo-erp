import { useState, type FormEvent, type JSX } from 'react';

import { useCatalogo } from '../hooks/useCatalogo';
import { eliminarRecurso, enviarJson } from '../lib/api';
import { formatearMoneda } from '../lib/formato';
import { claseStock } from '../lib/stock';
import { FiDelete, FiEdit } from 'react-icons/fi';
import type { Producto } from '../types';

export function Productos(): JSX.Element {
  const { productos, stock, cargando, error, recargar } = useCatalogo();
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [cantidadStock, setCantidadStock] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [creandoProducto, setCreandoProducto] = useState<boolean>(false);
  const [modalNuevoProducto, setModalNuevoProducto] = useState<boolean>(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState('producto');
  const [nuevoSku, setNuevoSku] = useState('');

  function abrirEdicion(producto: Producto): void {
    setProductoEditando(producto);
    setNombre(producto.nombre);
    setPrecio(String(producto.precio));
    setCantidadStock(String(stock[producto.id] ?? 0));
    setErrorAccion(null);
  }

  function cerrarEdicion(): void {
    if (guardando) {
      return;
    }

    setProductoEditando(null);
    setErrorAccion(null);
  }

  async function guardarProducto(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!productoEditando) {
      return;
    }

    const nombreNormalizado = nombre.trim();
    const precioNumero = Number(precio);
    const stockNumero = Number(cantidadStock);

    if (nombreNormalizado === '') {
      setErrorAccion('Ingresa el nombre del producto.');
      return;
    }

    if (!Number.isFinite(precioNumero) || precioNumero < 0) {
      setErrorAccion('El precio debe ser un número mayor o igual a 0.');
      return;
    }

    if (!Number.isInteger(stockNumero) || stockNumero < 0) {
      setErrorAccion('El stock debe ser un número entero mayor o igual a 0.');
      return;
    }

    setGuardando(true);
    setErrorAccion(null);

    try {
      await enviarJson<Producto>(
        `/api/productos/${productoEditando.id}`,
        'PUT',
        {
          nombre: nombreNormalizado,
          precio: precioNumero,
          stock: stockNumero,
        },
      );

      setProductoEditando(null);
      recargar();
    } catch (caught) {
      setErrorAccion(
        caught instanceof Error
          ? caught.message
          : 'No se pudo actualizar el producto',
      );
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarProducto(producto: Producto): Promise<void> {
    const confirmado = window.confirm(
      `¿Eliminar el producto "${producto.nombre}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmado) {
      return;
    }

    setErrorAccion(null);
    setEliminandoId(producto.id);

    try {
      await eliminarRecurso(`/api/productos/${producto.id}`);
      recargar();
    } catch (caught) {
      setErrorAccion(
        caught instanceof Error
          ? caught.message
          : 'No se pudo eliminar el producto',
      );
    } finally {
      setEliminandoId(null);
    }
  }

  async function crearProductoNuevo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const skuNormalizado = nuevoSku.trim();
    const nombreNormalizado = nuevoNombre.trim();
    const precioNumero = Number(nuevoPrecio);

    if (skuNormalizado === '') {
      setErrorAccion('Ingresa el SKU del producto.');
      return;
    }

    if (nombreNormalizado === '') {
      setErrorAccion('Ingresa el nombre del producto.');
      return;
    }

    if (!Number.isFinite(precioNumero) || precioNumero < 0) {
      setErrorAccion('El precio debe ser un número mayor o igual a 0.');
      return;
    }

    setCreandoProducto(true);
    setErrorAccion(null);

    try {
      await enviarJson<Producto>('/api/productos', 'POST', {
        sku: skuNormalizado,
        nombre: nombreNormalizado,
        precio: precioNumero,
        tipo: nuevoTipo,
      });

      setModalNuevoProducto(false);
      recargar();
    } catch (caught) {
      setErrorAccion(
        caught instanceof Error
          ? caught.message
          : 'No se pudo crear el producto',
      );
    } finally {
      setCreandoProducto(false);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header pagina-header-con-accion">
        <div>
          <h2>Productos y Stock</h2>
          <p className="app-description">
            Catálogo disponible y existencias registradas para cada producto.
          </p>
        </div>

      </header>

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      ) : null}

      {errorAccion ? (
        <p role="alert" className="alert alert-error">
          {errorAccion}
        </p>
      ) : null}

      <section className="app-card" aria-labelledby="inventario-titulo">
        <div className="seccion-cabecera">
          <h3 id="inventario-titulo" className="seccion-titulo">
            Inventario
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="boton-primario boton-compacto"
              onClick={() => {
                setNuevoNombre('');
                setNuevoPrecio('');
                setNuevoTipo('producto');
                setNuevoSku('');
                setModalNuevoProducto(true);
              }}
            >
              Nuevo Producto
            </button>
            <button
              type="button"
              className="boton-secundario boton-compacto"
              onClick={recargar}
              disabled={cargando}
            >
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>

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
                  <th scope="col"></th>
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
                      <td>
                        <div className="acciones-tabla">
                          <button
                            type="button"
                            className="boton-icono boton-editar"
                            aria-label={`Editar ${producto.nombre}`}
                            title="Editar producto"
                            onClick={() => abrirEdicion(producto)}
                          >
                            <FiEdit size={16} />
                          </button>
                          <button
                            type="button"
                            className="boton-eliminar-icono"
                            aria-label={`Eliminar ${producto.nombre}`}
                            title="Eliminar producto"
                            disabled={eliminandoId === producto.id}
                            onClick={() => {
                              void eliminarProducto(producto);
                            }}
                          >
                            {eliminandoId === producto.id ? '…' : <FiDelete size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {productoEditando ? (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-producto-titulo"
          >
            <h3 id="editar-producto-titulo" className="seccion-titulo">
              Editar producto
            </h3>

            <form
              className="producto-form"
              onSubmit={(event) => {
                void guardarProducto(event);
              }}
            >
              <div className="producto-form-campo">
                <label htmlFor="producto-nombre">Nombre</label>
                <input
                  id="producto-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                />
              </div>

              <div className="producto-form-campo">
                <label htmlFor="producto-precio">Precio</label>
                <input
                  id="producto-precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={precio}
                  onChange={(event) => setPrecio(event.target.value)}
                />
              </div>

              <div className="producto-form-campo">
                <label htmlFor="producto-stock">Stock actual</label>
                <input
                  id="producto-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={cantidadStock}
                  onChange={(event) => setCantidadStock(event.target.value)}
                />
              </div>

              {errorAccion ? (
                <p role="alert" className="alert alert-error">
                  {errorAccion}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={cerrarEdicion}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {modalNuevoProducto ? (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nuevo-producto-titulo"
          >
            <h3 id="nuevo-producto-titulo" className="seccion-titulo">
              Nuevo Producto
            </h3>

            <form
              className="producto-form"
              onSubmit={(event) => {
                void crearProductoNuevo(event);
              }}
            >
              <div className="producto-form-campo">
                <label htmlFor="nuevo-sku">SKU</label>
                <input
                  id="nuevo-sku"
                  type="text"
                  value={nuevoSku}
                  onChange={(event) => setNuevoSku(event.target.value)}
                />
              </div>

              <div className="producto-form-campo">
                <label htmlFor="nuevo-nombre">Nombre</label>
                <input
                  id="nuevo-nombre"
                  type="text"
                  value={nuevoNombre}
                  onChange={(event) => setNuevoNombre(event.target.value)}
                />
              </div>

              <div className="producto-form-campo">
                <label htmlFor="nuevo-precio">Precio</label>
                <input
                  id="nuevo-precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={nuevoPrecio}
                  onChange={(event) => setNuevoPrecio(event.target.value)}
                />
              </div>

              <div className="producto-form-campo">
                <label htmlFor="nuevo-tipo">Tipo</label>
                <select
                  id="nuevo-tipo"
                  value={nuevoTipo}
                  onChange={(event) => setNuevoTipo(event.target.value)}
                >
                  <option value="producto">Producto</option>
                  <option value="servicio">Servicio</option>
                </select>
              </div>

              {errorAccion ? (
                <p role="alert" className="alert alert-error">
                  {errorAccion}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={() => setModalNuevoProducto(false)}
                  disabled={creandoProducto}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={creandoProducto}>
                  {creandoProducto ? 'Creando…' : 'Crear producto'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
