import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { Contabilidad } from './Contabilidad';

const fetchMock = vi.fn();

const instalarFetch = () => {
  fetchMock.mockReset();

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
};

const respuestaJson = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('Página de Contabilidad', () => {
  beforeEach(() => {
    instalarFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renderiza la página de contabilidad', async () => {
    fetchMock.mockImplementation(() =>
      respuestaJson({ totalVentas: 0, cantidadVentas: 0, agrupacion: 'dia', datos: [], productosServicios: [] }),
    );

    render(
      <BrowserRouter>
        <Contabilidad />
      </BrowserRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Contabilidad' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Reporte de ventas')).toBeInTheDocument();
    expect(await screen.findByText('Asientos contables')).toBeInTheDocument();
  });

  it('muestra el reporte de ventas con totales', async () => {
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/contabilidad/reporte-ventas')) {
        return respuestaJson({
          totalVentas: 500000,
          cantidadVentas: 10,
          agrupacion: 'dia',
          datos: [{ clave: '2026-11-25', total: 300000, cantidad: 6 }, { clave: '2026-11-26', total: 200000, cantidad: 4 }],
          productosServicios: [],
        });
      }
      if (String(url).includes('/contabilidad/asientos')) {
        return respuestaJson([]);
      }
      return Promise.resolve(new Response('Not found', { status: 404 }));
    });

    render(
      <BrowserRouter>
        <Contabilidad />
      </BrowserRouter>,
    );

    expect(await screen.findByText('$ 500.000,00')).toBeInTheDocument();
    expect(await screen.findByText('10')).toBeInTheDocument();
    expect(await screen.findByText('2026-11-25')).toBeInTheDocument();
  });

  it('permite cambiar la agrupación del reporte', async () => {
    fetchMock.mockImplementation(() =>
      respuestaJson({ totalVentas: 0, cantidadVentas: 0, agrupacion: 'dia', datos: [], productosServicios: [] }),
    );

    render(
      <BrowserRouter>
        <Contabilidad />
      </BrowserRouter>,
    );

    const select = screen.getByRole('combobox', { name: /Agrupar por/i });
    fireEvent.change(select, { target: { value: 'mes' } });

    expect(select).toHaveValue('mes');
    expect(fetchMock).toHaveBeenCalled();
  });
});
