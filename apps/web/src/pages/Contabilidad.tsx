import { useCallback, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { BiWallet, BiCalendar, BiFilter, BiBarChart } from 'react-icons/bi';

import { useContabilidad } from '../hooks/useContabilidad';
import { formatearMoneda } from '../lib/formato';
import type { AgrupacionVentas } from '../types';

const AGRUPACIONES: Array<{ valor: AgrupacionVentas; etiqueta: string }> = [
  { valor: 'dia', etiqueta: 'Por día' },
  { valor: 'mes', etiqueta: 'Por mes' },
  { valor: 'anio', etiqueta: 'Por año' },
  { valor: 'medio_pago', etiqueta: 'Por medio de pago' },
];

export function Contabilidad(): JSX.Element {
  const [agrupacion, setAgrupacion] = useState<AgrupacionVentas>('dia');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const {
    caja,
    asientos,
    reporte,
    cargando,
    error,
    abrirCaja,
    cerrarCaja,
    cargarCajaActual,
    cargarAsientos,
    cargarReporte,
    limpiarError,
  } = useContabilidad();

  const [usuarioId, setUsuarioId] = useState('');
  const [montoInicial, setMontoInicial] = useState('');
  const [montoFinal, setMontoFinal] = useState('');
  const [cajaIdParaCierre, setCajaIdParaCierre] = useState('');

  const manejarAbrirCaja = useCallback(async () => {
    if (!usuarioId || montoInicial === '') return;
    await abrirCaja(usuarioId, Number.parseFloat(montoInicial));
    await cargarCajaActual(usuarioId);
    setMontoInicial('');
  }, [usuarioId, montoInicial, abrirCaja, cargarCajaActual]);

  const manejarCerrarCaja = useCallback(async () => {
    if (!cajaIdParaCierre || montoFinal === '') return;
    await cerrarCaja(cajaIdParaCierre, Number.parseFloat(montoFinal));
    setCajaIdParaCierre('');
    setMontoFinal('');
    if (caja?.usuarioId) {
      await cargarCajaActual(caja?.usuarioId);
    }
  }, [cajaIdParaCierre, montoFinal, cerrarCaja, caja]);

  const manejarCambiarAgrupacion = useCallback(
    (valor: AgrupacionVentas) => {
      setAgrupacion(valor);
      void cargarReporte(desde, hasta, valor);
    },
    [desde, hasta, cargarReporte],
  );

  const manejarConsultarReporte = useCallback(() => {
    void cargarReporte(desde, hasta, agrupacion);
    void cargarAsientos(desde, hasta);
  }, [desde, hasta, agrupacion, cargarReporte, cargarAsientos]);

  const totalReporte = reporte?.totalVentas ?? 0;
  const cantidadReporte = reporte?.cantidadVentas ?? 0;

  return (
    <div className="pagina contabilidad-pagina">
      <header className="pagina-header">
        <div>
          <Link to="/contabilidad" className="pagina-volver" aria-label="Volver">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M19 12H5M11 6l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            Contabilidad
          </Link>
          <h2>Contabilidad</h2>
          <p className="app-description">
            Consulta de caja, asientos contables y reportes de ventas.
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
          <button
            type="button"
            className="boton-secundario boton-compacto"
            onClick={limpiarError}
          >
            Descartar
          </button>
        </p>
      ) : null}

      <section className="app-card">
        <h3 className="seccion-titulo">
          <BiWallet size={20} className="mr-2" /> Caja de punto de venta
        </h3>

        {caja ? (
          <>
            <div className="caja-estado">
              <span className={`estado-badge ${caja.cierre ? 'cerrada' : 'abierta'}`}>
                {caja.cierre ? 'Cerrada' : 'Abierta'}
              </span>
              <p>
                Usuario: {caja.usuarioId}
              </p>
              <p>
                Apertura: {new Date(caja.apertura).toLocaleString()}
              </p>
              <p>
                Monto inicial: {formatearMoneda(caja.montoInicial)}
              </p>
              {caja.cierre && caja.montoFinal !== null && (
                <>
                  <p>
                    Cierre: {new Date(caja.cierre).toLocaleString()}
                  </p>
                  <p>
                    Monto final: {formatearMoneda(caja.montoFinal)}
                  </p>
                </>
              )}
            </div>

            {!caja.cierre ? (
              <div className="form-inline">
                <label>Monto final de cierre</label>
                <input
                  type="number"
                  value={montoFinal}
                  onChange={(e) => setMontoFinal(e.target.value)}
                  placeholder="0"
                />
                <button
                  type="button"
                  className="boton-procesar"
                  onClick={manejarCerrarCaja}
                  disabled={!montoFinal}
                >
                  Cerrar caja
                </button>
                <input
                  type="hidden"
                  value={caja.id}
                  onChange={(e) => setCajaIdParaCierre(e.target.value)}
                />
              </div>
            ) : (
              <div className="form-inline">
                <label>Usuario</label>
                <input
                  type="text"
                  value={usuarioId}
                  onChange={(e) => setUsuarioId(e.target.value)}
                  placeholder="ID de usuario"
                />
                <label>Monto inicial</label>
                <input
                  type="number"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  placeholder="0"
                />
                <button
                  type="button"
                  className="boton-procesar"
                  onClick={manejarAbrirCaja}
                  disabled={!usuarioId || !montoInicial}
                >
                  Abrir caja
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="form-inline">
            <label>Usuario</label>
            <input
              type="text"
              value={usuarioId}
              onChange={(e) => setUsuarioId(e.target.value)}
              placeholder="ID de usuario"
            />
            <label>Monto inicial</label>
            <input
              type="number"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              placeholder="0"
            />
            <button
              type="button"
              className="boton-procesar"
              onClick={manejarAbrirCaja}
              disabled={!usuarioId || !montoInicial}
            >
              Abrir caja
            </button>
          </div>
        )}
      </section>

      <section className="app-card">
        <h3 className="seccion-titulo">
          <BiBarChart size={20} className="mr-2" /> Reporte de ventas
        </h3>

        <div className="filtros-reporte">
          <div className="campo-filtro">
            <label>Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="campo-filtro">
            <label>Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <div className="campo-filtro">
            <label htmlFor="agrupacion">Agrupar por</label>
            <select
              id="agrupacion"
              value={agrupacion}
              onChange={(e) => manejarCambiarAgrupacion(e.target.value as AgrupacionVentas)}
            >
              {AGRUPACIONES.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="campo-filtro">
            <button type="button" className="boton-procesar" onClick={manejarConsultarReporte}>
              <BiFilter size={18} className="mr-2" /> Consultar
            </button>
          </div>
        </div>

        <div className="tarjetas-resumen">
          <div className="tarjeta">
            <p className="etiqueta">Total ventas</p>
            <p className="valor">{formatearMoneda(totalReporte)}</p>
          </div>
          <div className="tarjeta">
            <p className="etiqueta">Transacciones</p>
            <p className="valor">{cantidadReporte}</p>
          </div>
        </div>

        <table className="tabla-reporte">
          <thead>
            <tr>
              <th scope="col">{agrupacion === 'medio_pago' ? 'Medio de pago' : 'Fecha'}</th>
              <th scope="col">Total</th>
              <th scope="col">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {reporte?.datos.map((d) => (
              <tr key={d.clave}>
                <td>{d.clave}</td>
                <td>{formatearMoneda(d.total)}</td>
                <td>{d.cantidad}</td>
              </tr>
            ))}
            {reporte?.datos.length === 0 && (
              <tr>
                <td colSpan={3}>No hay datos en el período seleccionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="app-card">
        <h3 className="seccion-titulo">
          <BiCalendar size={20} className="mr-2" /> Asientos contables
        </h3>
        <button
          type="button"
          className="boton-secundario boton-compacto"
          onClick={() => {
            void cargarAsientos(desde, hasta);
          }}
        >
          {cargando ? 'Cargando…' : 'Actualizar asientos'}
        </button>
        <table className="tabla-asientos">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Cuenta</th>
              <th scope="col">Débito</th>
              <th scope="col">Crédito</th>
              <th scope="col">Origen</th>
              <th scope="col">Método de pago</th>
            </tr>
          </thead>
          <tbody>
            {asientos.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.fecha).toLocaleString()}</td>
                <td>{a.cuenta}</td>
                <td>{formatearMoneda(a.debito)}</td>
                <td>{formatearMoneda(a.credito)}</td>
                <td>{a.origenId}</td>
                <td>{a.metodoPago ?? '—'}</td>
              </tr>
            ))}
            {asientos.length === 0 && (
              <tr>
                <td colSpan={6}>No hay asientos contables.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {cargando && (
        <p className="app-empty">Cargando datos de contabilidad…</p>
      )}
    </div>
  );
}
