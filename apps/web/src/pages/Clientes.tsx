import { useEffect, useState, type FormEvent, type JSX } from 'react';

import { obtenerJson, enviarJson, eliminarRecurso } from '../lib/api';
import { FiDelete } from 'react-icons/fi';
import type { CanalPreferido, Cliente } from '../types';

interface ClienteApi {
  id: string;
  nombre: string;
  documento: string;
  email: string | null;
  telefono: string | null;
  canal_preferido: CanalPreferido | null;
}

function deApi(cliente: ClienteApi): Cliente {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    documento: cliente.documento,
    email: cliente.email,
    telefono: cliente.telefono,
    canalPreferido: cliente.canal_preferido ?? 'email',
  };
}

const CANALES: [CanalPreferido, string][] = [
  ['email', 'Correo electrónico'],
  ['sms', 'SMS'],
  ['whatsapp', 'WhatsApp'],
];

const ETIQUETAS_CANAL: Record<CanalPreferido, string> = Object.fromEntries(
  CANALES,
) as Record<CanalPreferido, string>;

export function Clientes(): JSX.Element {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [canalPreferido, setCanalPreferido] = useState<CanalPreferido>('email');

  useEffect(() => {
    let activo = true;

    async function cargar(): Promise<void> {
      setCargando(true);
      setError(null);

      try {
        const clientesApi = await obtenerJson<ClienteApi[]>('/api/clientes');

        if (activo) {
          setClientes(clientesApi.map(deApi));
        }
      } catch (caught) {
        if (activo) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'No se pudieron cargar los clientes',
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [recarga]);

  function abrirNuevoCliente(): void {
    setErrorAccion(null);
    setNombre('');
    setDocumento('');
    setEmail('');
    setTelefono('');
    setCanalPreferido('email');
    setAbierto(true);
  }

  function cerrarNuevoCliente(): void {
    if (guardando) {
      return;
    }

    setAbierto(false);
  }

  async function eliminarCliente(cliente: Cliente): Promise<void> {
    const confirmado = window.confirm(
      `¿Eliminar el cliente "${cliente.nombre}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmado) {
      return;
    }

    setErrorAccion(null);
    setEliminandoId(cliente.id);

    try {
      await eliminarRecurso(`/api/clientes/${cliente.id}`);
      setClientes((actuales) =>
        actuales.filter((actual) => actual.id !== cliente.id),
      );
      setRecarga((valor) => valor + 1);
    } catch (caught) {
      setErrorAccion(
        caught instanceof Error
          ? caught.message
          : 'No se pudo eliminar el cliente',
      );
    } finally {
      setEliminandoId(null);
    }
  }

  async function crearCliente(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const nombreNormalizado = nombre.trim();
    const documentoNormalizado = documento.trim();

    if (nombreNormalizado === '') {
      setErrorAccion('Ingresa el nombre del cliente.');
      return;
    }

    if (documentoNormalizado === '') {
      setErrorAccion('Ingresa el documento del cliente.');
      return;
    }

    setGuardando(true);
    setErrorAccion(null);

    try {
      await enviarJson<Cliente>('/api/clientes', 'POST', {
        nombre: nombreNormalizado,
        documento: documentoNormalizado,
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
        canalPreferido,
      });

      setAbierto(false);
      setRecarga((valor) => valor + 1);
    } catch (caught) {
      setErrorAccion(
        caught instanceof Error
          ? caught.message
          : 'No se pudo crear el cliente',
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header">
        <div>
          <h2>Clientes</h2>
          <p className="app-description">
            Administración de clientes y su información de contacto.
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="alert alert-error">{error}</p>
      ) : null}

      {errorAccion ? (
        <p role="alert" className="alert alert-error">{errorAccion}</p>
      ) : null}

      <section className="app-card" aria-labelledby="clientes-titulo">
        <div className="seccion-cabecera flex justify-between items-center">
          <h3 id="clientes-titulo" className="seccion-titulo">
            Clientes registrados
          </h3>
          <button
            type="button"
            className="boton-primario boton-compacto"
            onClick={abrirNuevoCliente}
            disabled={cargando}
          >
            Nuevo Cliente
          </button>
        </div>

        {cargando ? (
          <p className="app-empty">Cargando clientes…</p>
        ) : clientes.length === 0 ? (
          <p className="app-empty">No hay clientes registrados.</p>
        ) : (
          <div className="tabla-contenedor">
            <table className="productos-tabla">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Teléfono</th>
                  <th scope="col">Canal preferido</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.nombre}</td>
                    <td>{cliente.documento}</td>
                    <td>{cliente.email ?? '—'}</td>
                    <td>{cliente.telefono ?? '—'}</td>
                    <td>
                      <span className={`canal canal-${cliente.canalPreferido}`}>
                        {ETIQUETAS_CANAL[cliente.canalPreferido]}
                      </span>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        <button
                          type="button"
                          className="boton-eliminar-icono"
                          aria-label={`Eliminar ${cliente.nombre}`}
                          title="Eliminar cliente"
                          disabled={eliminandoId === cliente.id}
                          onClick={() => {
                            void eliminarCliente(cliente);
                          }}
                        >
                          {eliminandoId === cliente.id ? '…' : <FiDelete size={16} />}
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

      {abierto ? (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nuevo-cliente-titulo"
          >
            <h3 id="nuevo-cliente-titulo" className="seccion-titulo">
              Nuevo cliente
            </h3>

            <form
              className="cliente-form"
              onSubmit={(event) => {
                void crearCliente(event);
              }}
            >
              <div className="cliente-form-campo">
                <label htmlFor="cliente-nombre">Nombre</label>
                <input
                  id="cliente-nombre"
                  type="text"
                  autoFocus
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                />
              </div>

              <div className="cliente-form-campo">
                <label htmlFor="cliente-documento">Documento</label>
                <input
                  id="cliente-documento"
                  type="text"
                  value={documento}
                  onChange={(event) => setDocumento(event.target.value)}
                />
              </div>

              <div className="cliente-form-campo">
                <label htmlFor="cliente-email">Correo electrónico</label>
                <input
                  id="cliente-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="cliente-form-campo">
                <label htmlFor="cliente-telefono">Teléfono</label>
                <input
                  id="cliente-telefono"
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                />
              </div>

              <div className="cliente-form-campo">
                <label htmlFor="cliente-canal">Canal preferido</label>
                <select
                  id="cliente-canal"
                  value={canalPreferido}
                  onChange={(event) =>
                    setCanalPreferido(event.target.value as CanalPreferido)
                  }
                >
                  {CANALES.map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
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
                  onClick={cerrarNuevoCliente}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
