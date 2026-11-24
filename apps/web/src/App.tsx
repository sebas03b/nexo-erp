import type { JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes, Outlet } from 'react-router-dom';

import { Layout } from './components/Layout';
import { Citas } from './pages/Citas';
import { Clientes } from './pages/Clientes';
import { Contabilidad } from './pages/Contabilidad';
import { GestionUsuarios } from './pages/GestionUsuarios';
import { ListadoVentas } from './pages/ListadoVentas';
import { Login } from './pages/Login';
import { Nomina } from './pages/Nomina';
import { NuevaVenta } from './pages/NuevaVenta';
import { Productos } from './pages/Productos';
import { AuthProvider, useAuth } from './hooks/useAuth';

function RequireAuth() {
  const { usuario, cargando } = useAuth();
  if (cargando) {
    return <div className="app-empty">Cargando…</div>;
  }
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/ventas" replace />} />
            <Route element={<RequireAuth />}>
              <Route path="/ventas" element={<ListadoVentas />} />
              <Route path="/ventas/nueva" element={<NuevaVenta />} />
              <Route path="/productos" element={<Productos />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/citas" element={<Citas />} />
              <Route path="/contabilidad" element={<Contabilidad />} />
              <Route path="/nomina" element={<Nomina />} />
              <Route path="/usuarios" element={<GestionUsuarios />} />
            </Route>
            <Route path="*" element={<Navigate to="/ventas" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
