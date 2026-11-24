import { useCallback, useEffect, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { BiUserPlus, BiUser } from 'react-icons/bi';

import { enviarJson, obtenerJson } from '../lib/api';

export function GestionUsuarios(): JSX.Element {
  const [usuarios, setUsuarios] = useState<Array<{
    id: string;
    nombre: string;
    rol: string;
  }>>([]);
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<'admin' | 'cajero' | 'contador'>('cajero');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerJson<Array<{
        id: string;
        nombre: string;
        rol: string;
      }>>('/api/usuarios');
      setUsuarios(data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudieron cargar los usuarios',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarUsuarios();
  }, [cargarUsuarios]);

  const crearUsuario = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await enviarJson<{
        id: string;
        nombre: string;
        rol: string;
      }>('/api/auth/registro', 'POST', {
        nombre,
        rol,
        password,
      });
      setUsuarios((prev) => [...prev, resultado]);
      setNombre('');
      setRol('cajero');
      setPassword('');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo crear el usuario',
      );
    } finally {
      setCargando(false);
    }
  }, [nombre, rol, password]);

  return (
    <div className="pagina gestion-usuarios-pagina">
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
          <h2>Gestión de Usuarios</h2>
          <p className="app-description">
            Administra usuarios y roles del sistema.
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
          <button
            type="button"
            className="boton-secundario boton-compacto"
            onClick={() => setError(null)}
          >
            Descartar
          </button>
        </p>
      ) : null}

      <section className="app-card">
        <h3 className="seccion-titulo">
          <BiUserPlus size={20} className="mr-2" /> Crear usuario
        </h3>
        <div className="form-grid">
          <div className="campo-formulario">
            <label htmlFor="nombre">Nombre de usuario</label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: cajero1"
            />
          </div>
          <div className="campo-formulario">
            <label htmlFor="rol">Rol</label>
            <select id="rol" value={rol} onChange={(e) => setRol(e.target.value as 'admin' | 'cajero' | 'contador')}>
              <option value="cajero">Cajero</option>
              <option value="contador">Contador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="campo-formulario">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="campo-formulario campo-boton">
            <button
              type="button"
              className="boton-procesar"
              onClick={crearUsuario}
              disabled={!nombre || !password || cargando}
            >
              {cargando ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        </div>
      </section>

      <section className="app-card">
        <h3 className="seccion-titulo">
          <BiUser size={20} className="mr-2" /> Usuarios registrados
        </h3>
        {cargando && <p className="app-empty">Cargando usuarios…</p>}
        {usuarios.length === 0 && !cargando && (
          <p className="app-empty">No hay usuarios registrados.</p>
        )}
        {usuarios.length > 0 && (
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Rol</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td>{u.rol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
