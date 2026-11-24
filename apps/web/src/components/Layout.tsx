import type { JSX, ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BiCalculator, BiCartAlt, BiBox, BiGroup, BiCalendar, BiWallet, BiIdCard, BiLogOut, BiUserPlus } from 'react-icons/bi';
import { useAuth } from '../hooks/useAuth';
import logoSidebar from '../assets/logonexo1.png';

interface EnlaceSidebar {
  id: string;
  to: string;
  etiqueta: string;
  icono: ReactNode;
  rol?: 'admin' | 'cajero' | 'contador';
}

const enlaces: EnlaceSidebar[] = [
  {
    id: 'ventas',
    to: '/ventas',
    etiqueta: 'Ventas',
    icono: <BiCartAlt size={20} className="mr-2" />,
  },
  {
    id: 'productos',
    to: '/productos',
    etiqueta: 'Productos y Stock',
    icono: <BiBox size={20} className="mr-2" />,
  },
  {
    id: 'clientes',
    to: '/clientes',
    etiqueta: 'Clientes',
    icono: <BiGroup size={20} className="mr-2" />,
  },
  {
    id: 'citas',
    to: '/citas',
    etiqueta: 'Citas',
    icono: <BiCalendar size={20} className="mr-2" />,
  },
  {
    id: 'contabilidad',
    to: '/contabilidad',
    etiqueta: 'Contabilidad',
    icono: <BiWallet size={20} className="mr-2" />,
    rol: 'contador',
  },
  {
    id: 'nomina',
    to: '/nomina',
    etiqueta: 'Nómina',
    icono: <BiCalculator size={20} className="mr-2" />,
    rol: 'admin',
  },
  {
    id: 'usuarios',
    to: '/usuarios',
    etiqueta: 'Gestión de Usuarios',
    icono: <BiUserPlus size={20} className="mr-2" />,
    rol: 'admin',
  },
  {
    id: 'personal',
    to: '#',
    etiqueta: 'Gestión de personal',
    icono: <BiIdCard size={20} className="mr-2" />,
  },
];

export function Layout(): JSX.Element {
  const { usuario, logout, cargando } = useAuth();
  const navigate = useNavigate();

  const enlacesFiltrados = cargando
    ? []
    : enlaces.filter((e) => !e.rol || e.rol === usuario?.rol || usuario?.rol === 'admin');

  const manejarCerrarSesion = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <header className="sidebar-header">
          <NavLink to="/ventas" className="sidebar-logo-contenedor" onClick={(e) => { e.preventDefault(); navigate('/ventas'); }}>
            <img src={logoSidebar} alt="Nexo-ERP" className="sidebar-logo" />
          </NavLink>
          {usuario && (
            <div className="usuario-info">
              <p className="usuario-nombre">{usuario.nombre}</p>
              <p className="usuario-rol">{usuario.rol}</p>
            </div>
          )}
        </header>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <p className="sidebar-seccion">Módulos</p>
          {enlacesFiltrados.map((enlace) => (
            <NavLink
              key={enlace.id}
              to={enlace.to}
              onClick={(e) => {
                if (enlace.to === '#') {
                  e.preventDefault();
                } else {
                  navigate(enlace.to);
                }
              }}
              className={({ isActive }) => {
                const esFicticio = enlace.to === '#';
                const estaActivo = !esFicticio && isActive;
                return estaActivo
                  ? 'sidebar-enlace sidebar-enlace-activo'
                  : 'sidebar-enlace';
              }}
            >
              <span className="sidebar-icono">{enlace.icono}</span>
              <span>{enlace.etiqueta}</span>
            </NavLink>
          ))}
          <div className="sidebar-seccion">Sesión</div>
          <button
            className="sidebar-enlace"
            onClick={manejarCerrarSesion}
            disabled={cargando}
          >
            <span className="sidebar-icono">{<BiLogOut size={20} className="mr-2" />}</span>
            <span>Cerrar sesión</span>
          </button>
        </nav>
      </aside>

      <main className="app-contenido">
        <Outlet />
      </main>
    </div>
  );
}
