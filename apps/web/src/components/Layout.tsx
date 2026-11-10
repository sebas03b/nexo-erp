import type { JSX, ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import logoSidebar from '../assets/logonexo1.png';

interface EnlaceSidebar {
  to: string;
  etiqueta: string;
  icono: ReactNode;
}

const enlaces: EnlaceSidebar[] = [
  {
    to: '/ventas',
    etiqueta: 'Ventas',
    icono: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M3 4h2l2.4 11.2A2 2 0 0 0 9.36 17H19a2 2 0 0 0 1.96-1.6L22 8H6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <circle cx="10" cy="20" r="1.4" fill="currentColor" />
        <circle cx="18" cy="20" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: '/productos',
    etiqueta: 'Productos y Stock',
    icono: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 3 21 7.5 12 12 3 7.5 12 3Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="M3 7.5V16l9 4.5V12M21 7.5V16l-9 4.5"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    ),
  },
  {
    to: '/clientes',
    etiqueta: 'Clientes',
    icono: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle
          cx="9"
          cy="8"
          r="3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.2A5.5 5.5 0 0 1 20.5 19"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
    ),
  },
];

export function Layout(): JSX.Element {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <NavLink to="/ventas" className="sidebar-marca sidebar-logo-contenedor">
          <img src={logoSidebar} alt="Nexo-ERP" className="sidebar-logo" />
        </NavLink>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <p className="sidebar-seccion">Módulos</p>
          {enlaces.map((enlace) => (
            <NavLink
              key={enlace.to}
              to={enlace.to}
              className={({ isActive }) =>
                isActive ? 'sidebar-enlace sidebar-enlace-activo' : 'sidebar-enlace'
              }
            >
              <span className="sidebar-icono">{enlace.icono}</span>
              <span>{enlace.etiqueta}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="app-contenido">
        <Outlet />
      </main>
    </div>
  );
}
