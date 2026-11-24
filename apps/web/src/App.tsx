import type { JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { Citas } from './pages/Citas';
import { Clientes } from './pages/Clientes';
import { Contabilidad } from './pages/Contabilidad';
import { ListadoVentas } from './pages/ListadoVentas';
import { Nomina } from './pages/Nomina';
import { NuevaVenta } from './pages/NuevaVenta';
import { Productos } from './pages/Productos';

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/ventas" replace />} />
          <Route path="/ventas" element={<ListadoVentas />} />
          <Route path="/ventas/nueva" element={<NuevaVenta />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/citas" element={<Citas />} />
          <Route path="/contabilidad" element={<Contabilidad />} />
          <Route path="/nomina" element={<Nomina />} />
          <Route path="*" element={<Navigate to="/ventas" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
