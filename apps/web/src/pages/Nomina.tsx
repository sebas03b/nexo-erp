import { useCallback, useEffect, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { BiCalculator, BiListUl, BiWallet } from 'react-icons/bi';

import { obtenerJson, enviarJson } from '../lib/api';
import { formatearMoneda } from '../lib/formato';
import type { ConceptoNomina, Empleado, LiquidacionResultado } from '../types';

export function Nomina(): JSX.Element {
  const [empleadoId, setEmpleadoId] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [salarioBase, setSalarioBase] = useState('');
  const [horasExtras, setHorasExtras] = useState('');
  const [auxilioTransporte, setAuxilioTransporte] = useState('');

  const [conceptos, ] = useState<ConceptoNomina[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionResultado[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarEmpleados = useCallback(async () => {
    try {
      const data = await obtenerJson<Empleado[]>('/api/empleados');
      setEmpleados(data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudieron cargar los empleados',
      );
    }
  }, []);

  useEffect(() => {
    void cargarEmpleados();
  }, [cargarEmpleados]);

  const calcularLiquidacion = useCallback(
    async (
      eId: string,
      p: string,
      sb: number,
      he?: number,
      at?: number,
    ) => {
      setCargando(true);
      setError(null);
      try {
        const resultado = await enviarJson<LiquidacionResultado>(
          '/api/nomina/calcular',
          'POST',
          {
            empleadoId: eId,
            periodo: p,
            salarioBase: sb,
            horasExtras: he,
            auxilioTransporte: at,
          },
        );
        setLiquidaciones((prev) => [
          resultado,
          ...prev.filter(
            (l) => !(l.empleadoId === eId && l.periodo === p),
          ),
        ]);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Error al calcular',
        );
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  const listarLiquidaciones = useCallback(
    async (eId?: string, p?: string) => {
      setCargando(true);
      setError(null);
      try {
        const url = new URL(
          '/api/nomina/liquidaciones',
          window.location.origin,
        );
        if (eId) url.searchParams.set('empleadoId', eId);
        if (p) url.searchParams.set('periodo', p);
        const data = await obtenerJson<LiquidacionResultado[]>(
          url.toString(),
        );
        setLiquidaciones(data);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'No se pudieron cargar las liquidaciones',
        );
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  const manejarCalcular = useCallback(() => {
    if (!empleadoId || !periodo || salarioBase === '') return;
    void calcularLiquidacion(
      empleadoId,
      periodo,
      Number.parseFloat(salarioBase),
      horasExtras ? Number.parseFloat(horasExtras) : undefined,
      auxilioTransporte ? Number.parseFloat(auxilioTransporte) : undefined,
    );
    void listarLiquidaciones(empleadoId, periodo);
  }, [
    empleadoId,
    periodo,
    salarioBase,
    horasExtras,
    auxilioTransporte,
    calcularLiquidacion,
    listarLiquidaciones,
  ]);

  const manejarListar = useCallback(() => {
    void listarLiquidaciones(empleadoId, periodo);
  }, [empleadoId, periodo, listarLiquidaciones]);

  const limpiarError = useCallback(() => setError(null), []);

  const totalNeto = liquidaciones.reduce(
    (acc, l) => acc + l.netoAPagar,
    0,
  );

  return (
    <div className="pagina nomina-pagina">
      <header className="pagina-header">
        <div>
          <Link to="/nomina" className="pagina-volver" aria-label="Volver">
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
            Nómina
          </Link>
          <h2>Nómina</h2>
          <p className="app-description">
            Cálculo de liquidaciones de nómina por empleado y período.
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
          <BiCalculator size={20} className="mr-2" /> Calcular liquidación
        </h3>
        <div className="form-grid">
          <div className="campo-formulario">
            <label htmlFor="empleadoId">Empleado</label>
            <select
              id="empleadoId"
              value={empleadoId}
              onChange={(e) => setEmpleadoId(e.target.value)}
            >
              <option value="">Seleccionar empleado</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo-formulario">
            <label htmlFor="periodo">Período</label>
            <input
              id="periodo"
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="YYYY-MM"
            />
          </div>
          <div className="campo-formulario">
            <label htmlFor="salarioBase">Salario base</label>
            <input
              id="salarioBase"
              type="number"
              value={salarioBase}
              onChange={(e) => setSalarioBase(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="campo-formulario">
            <label htmlFor="horasExtras">Horas extras</label>
            <input
              id="horasExtras"
              type="number"
              value={horasExtras}
              onChange={(e) => setHorasExtras(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="campo-formulario">
            <label htmlFor="auxilioTransporte">
              Auxilio transporte (1=sí, 0=no)
            </label>
            <input
              id="auxilioTransporte"
              type="number"
              value={auxilioTransporte}
              onChange={(e) => setAuxilioTransporte(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="campo-formulario campo-boton">
            <button
              type="button"
              className="boton-procesar"
              onClick={manejarCalcular}
              disabled={!empleadoId || !periodo || !salarioBase}
            >
              {cargando ? 'Calculando…' : 'Calcular liquidación'}
            </button>
          </div>
        </div>
      </section>

      <section className="app-card">
        <h3 className="seccion-titulo">
          <BiListUl size={20} className="mr-2" /> Liquidaciones
        </h3>
        <div className="campo-formulario">
          <button
            type="button"
            className="boton-secundario boton-compacto"
            onClick={manejarListar}
          >
            {cargando ? 'Cargando…' : 'Listar liquidaciones'}
          </button>
        </div>
        {cargando && <p className="app-empty">Cargando liquidaciones…</p>}
        {liquidaciones.length === 0 && !cargando && (
          <p className="app-empty">No hay liquidaciones registradas.</p>
        )}
        {liquidaciones.length > 0 && (
          <table className="tabla-liquidaciones">
            <thead>
              <tr>
                <th scope="col">Empleado</th>
                <th scope="col">Período</th>
                <th scope="col">Salario base</th>
                <th scope="col">Devengos</th>
                <th scope="col">Deducciones</th>
                <th scope="col">Neto a pagar</th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.map((l) => (
                <tr key={`${l.empleadoId}-${l.periodo}`}>
                  <td>{l.empleadoId}</td>
                  <td>{l.periodo}</td>
                  <td>{formatearMoneda(l.salarioBase)}</td>
                  <td>{formatearMoneda(l.totalDevengos)}</td>
                  <td>{formatearMoneda(l.totalDeducciones)}</td>
                  <td>{formatearMoneda(l.netoAPagar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="app-card">
        <h3 className="seccion-titulo">
          <BiWallet size={20} className="mr-2" /> Resumen
        </h3>
        <div className="tarjetas-resumen">
          <div className="tarjeta">
            <p className="etiqueta">Liquidaciones</p>
            <p className="valor">{liquidaciones.length}</p>
          </div>
          <div className="tarjeta">
            <p className="etiqueta">Total neto a pagar</p>
            <p className="valor">{formatearMoneda(totalNeto)}</p>
          </div>
        </div>
      </section>

      {conceptos.length > 0 && (
        <section className="app-card">
          <h3 className="seccion-titulo">
            <BiWallet size={20} className="mr-2" /> Conceptos de nómina
          </h3>
          <table className="tabla-conceptos">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Activo</th>
              </tr>
            </thead>
            <tbody>
              {conceptos.map((c) => (
                <tr key={c.codigo}>
                  <td>{c.codigo}</td>
                  <td>{c.nombre}</td>
                  <td>{c.tipo}</td>
                  <td>{c.activo ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
