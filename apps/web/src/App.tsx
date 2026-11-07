import type { JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { Clientes } from './pages/Clientes';
import { ListadoVentas } from './pages/ListadoVentas';
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
          <Route path="*" element={<Navigate to="/ventas" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
