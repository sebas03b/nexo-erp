import { useState, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Login(): JSX.Element {
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const manejarSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(nombre, password);
      navigate('/ventas');
    } catch {
      setError('Credenciales incorrectas');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="pagina login-pagina">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Nexo-ERP</h1>
            <p>Iniciar sesión</p>
          </div>
          <form onSubmit={manejarSubmit}>
            <div className="campo-formulario">
              <label>Usuario</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ingresa tu usuario"
                required
              />
            </div>
            <div className="campo-formulario">
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
              />
            </div>
            {error && (
              <p className="error-mensaje">{error}</p>
            )}
            <button
              type="submit"
              className="boton-procesar"
              disabled={cargando}
            >
              {cargando ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
