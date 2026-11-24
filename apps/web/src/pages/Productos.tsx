import { useState, type FormEvent, type JSX } from 'react';
import { FiDelete, FiEdit } from 'react-icons/fi';

import { useCatalogo } from '../hooks/useCatalogo';
import { eliminarRecurso, enviarJson } from '../lib/api';
import { formatearMoneda } from '../lib/formato';
import { claseStock } from '../lib/stock';
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
  const [nuevoTipo, setNuevoTipo] = useState<'producto' | 'servicio'>('producto');
  const [nuevoSku, setNuevoSku] = useState('');

  const productosFiltrados = productos.filter((p) => p.tipo === 'producto');
  const serviciosFiltrados = productos.filter((p) => p.tipo === 'servicio');

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

  function abrirNuevo(tipo: 'producto' | 'servicio'): void {
    setNuevoNombre('');
    setNuevoPrecio('');
    setNuevoTipo(tipo);
    setNuevoSku('');
    setErrorAccion(null);
    setModalNuevoProducto(true);
  }

  async function guardarProducto(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!productoEditando) {
      return;
    }

    const nombreNormalizado = nombre.trim();
    const precioNumero = Number(precio);
    const esServicio = productoEditando.tipo === 'servicio';
    const stockNumero = Number(cantidadStock);

    if (nombreNormalizado === '') {
      setErrorAccion('Ingresa el nombre del producto.');
      return;
    }

    if (!Number.isFinite(precioNumero) || precioNumero < 0) {
      setErrorAccion('El precio debe ser un número mayor o igual a 0.');
      return;
    }

    if (!esServicio && (!Number.isInteger(stockNumero) || stockNumero < 0)) {
      setErrorAccion('El stock debe ser un número entero mayor o igual a 0.');
      return;
    }

    setGuardando(true);
    setErrorAccion(null);

    try {
      const payload: { nombre: string; precio: number; stock?: number } = {
        nombre: nombreNormalizado,
        precio: precioNumero,
      };
      if (!esServicio) {
        payload.stock = stockNumero;
      }

      await enviarJson<Producto>(
        `/api/productos/${productoEditando.id}`,
        'PUT',
        payload,
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

  function siguienteSkuServicio(): string {
    let max = 0;
    for (const p of productos) {
      if (p.tipo !== 'servicio') continue;
      const match = /^SRV-(\d+)$/i.exec(p.sku.trim());
      if (!match) continue;
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return `SRV-${String(max + 1).padStart(3, '0')}`;
  }

  async function crearProductoNuevo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const nombreNormalizado = nuevoNombre.trim();
    const precioNumero = Number(nuevoPrecio);
    const esServicio = nuevoTipo === 'servicio';
    const skuNormalizado = esServicio ? siguienteSkuServicio() : nuevoSku.trim();

    if (!esServicio && skuNormalizado === '') {
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

      <div className="space-y-6">
        <section className="app-card" aria-labelledby="productos-titulo">
          <div className="seccion-cabecera">
            <h3 id="productos-titulo" className="seccion-titulo">
              Productos
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                className="boton-primario boton-compacto"
                onClick={() => abrirNuevo('producto')}
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
          ) : productosFiltrados.length === 0 ? (
            <p className="app-empty">No hay productos registrados.</p>
          ) : (
            <div className="tabla-contenedor">
              <table className="productos-tabla">
                <thead>
                  <tr>
                    <th scope="col">SKU</th>
                    <th scope="col">Nombre</th>
                    <th scope="col">Precio</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((producto) => {
                    const cantidad = stock[producto.id] ?? 0;
                    return (
                      <tr key={producto.id}>
                        <td>{producto.sku}</td>
                        <td>{producto.nombre}</td>
                        <td>{formatearMoneda(producto.precio)}</td>
                        <td>
                          <span className={`stock-badge ${claseStock(cantidad)}`}>
                            {cantidad}
                          </span>
                        </td>
                        <td>
                          <div className="acciones-tabla flex justify-center items-center gap-2">
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

        <section className="app-card" aria-labelledby="servicios-titulo">
          <div className="seccion-cabecera">
            <h3 id="servicios-titulo" className="seccion-titulo">
              Servicios
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                className="boton-primario boton-compacto"
                onClick={() => abrirNuevo('servicio')}
              >
                Nuevo Servicio
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
            <p className="app-empty">Cargando servicios…</p>
          ) : serviciosFiltrados.length === 0 ? (
            <p className="app-empty">No hay servicios registrados.</p>
          ) : (
            <div className="tabla-contenedor">
              <table className="productos-tabla">
                <thead>
                  <tr>
                    <th scope="col">SKU</th>
                    <th scope="col">Nombre</th>
                    <th scope="col">Precio</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosFiltrados.map((servicio) => (
                    <tr key={servicio.id}>
                      <td>{servicio.sku}</td>
                      <td>{servicio.nombre}</td>
                      <td>{formatearMoneda(servicio.precio)}</td>
                      <td>
                        <div className="acciones-tabla flex justify-center items-center gap-2">
                          <button
                            type="button"
                            className="boton-icono boton-editar"
                            aria-label={`Editar ${servicio.nombre}`}
                            title="Editar producto"
                            onClick={() => abrirEdicion(servicio)}
                          >
                            <FiEdit size={16} />
                          </button>
                          <button
                            type="button"
                            className="boton-eliminar-icono"
                            aria-label={`Eliminar ${servicio.nombre}`}
                            title="Eliminar producto"
                            disabled={eliminandoId === servicio.id}
                            onClick={() => {
                              void eliminarProducto(servicio);
                            }}
                          >
                            {eliminandoId === servicio.id ? '…' : <FiDelete size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

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

              {productoEditando.tipo === 'servicio' ? null : (
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
              )}

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
              {nuevoTipo === 'servicio' ? 'Nuevo Servicio' : 'Nuevo Producto'}
            </h3>

            <form
              className="producto-form"
              onSubmit={(event) => {
                void crearProductoNuevo(event);
              }}
            >
              {nuevoTipo === 'servicio' ? null : (
                <div className="producto-form-campo">
                  <label htmlFor="nuevo-sku">SKU</label>
                  <input
                    id="nuevo-sku"
                    type="text"
                    value={nuevoSku}
                    onChange={(event) => setNuevoSku(event.target.value)}
                  />
                </div>
              )}

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
                  {creandoProducto ? 'Creando…' : nuevoTipo === 'servicio' ? 'Crear servicio' : 'Crear producto'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
