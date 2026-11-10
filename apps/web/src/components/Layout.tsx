import type { JSX, ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import {
  BiCartAlt,
  BiBox,
  BiGroup,
  BiCalendar,
  BiWallet,
  BiIdCard,
} from 'react-icons/bi';

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
    icono: <BiCartAlt size={20} className="mr-2" />,
  },
  {
    to: '/productos',
    etiqueta: 'Productos y Stock',
    icono: <BiBox size={20} className="mr-2" />,
  },
  {
    to: '/clientes',
    etiqueta: 'Clientes',
    icono: <BiGroup size={20} className="mr-2" />,
  },
  {
    to: '#',
    etiqueta: 'Citas',
    icono: <BiCalendar size={20} className="mr-2" />,
  },
  {
    to: '#',
    etiqueta: 'Contabilidad',
    icono: <BiWallet size={20} className="mr-2" />,
  },
  {
    to: '#',
    etiqueta: 'Gestión de personal',
    icono: <BiIdCard size={20} className="mr-2" />,
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
        </nav>
      </aside>

      <main className="app-contenido">
        <Outlet />
      </main>
    </div>
  );
}
