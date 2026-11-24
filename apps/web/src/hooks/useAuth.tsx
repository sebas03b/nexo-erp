import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface Usuario {
  id: string;
  nombre: string;
  rol: 'admin' | 'cajero' | 'contador';
}

interface AuthContextType {
  usuario: Usuario | null;
  cargando: boolean;
  login: (nombre: string, password: string) => Promise<void>;
  logout: () => void;
  estaAutenticado: boolean;
  tieneRol: (rol: 'admin' | 'cajero' | 'contador') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('nexo_token');
    const usuarioStr = localStorage.getItem('nexo_usuario');
    if (token && usuarioStr) {
      try {
        setUsuario(JSON.parse(usuarioStr));
      } catch {
        localStorage.removeItem('nexo_token');
        localStorage.removeItem('nexo_usuario');
      }
    }
    setCargando(false);
  }, []);

  const login = async (nombre: string, password: string) => {
    const respuesta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, password }),
    });

    if (!respuesta.ok) {
      throw new Error('Credenciales incorrectas');
    }

    const datos = await respuesta.json();
    localStorage.setItem('nexo_token', datos.token);
    localStorage.setItem('nexo_usuario', JSON.stringify(datos.usuario));
    setUsuario(datos.usuario);
  };

  const logout = () => {
    localStorage.removeItem('nexo_token');
    localStorage.removeItem('nexo_usuario');
    setUsuario(null);
  };

  const tieneRol = (rol: 'admin' | 'cajero' | 'contador') => {
    return usuario?.rol === rol || usuario?.rol === 'admin';
  };

  return (
    <AuthContext.Provider value={{
      usuario,
      cargando,
      login,
      logout,
      estaAutenticado: !!usuario,
      tieneRol,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return contexto;
}
