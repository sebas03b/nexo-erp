import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { Nomina } from './Nomina';

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

describe('Página de Nómina', () => {
  beforeEach(() => {
    instalarFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renderiza la página de nómina', async () => {
    fetchMock.mockImplementation(() => respuestaJson([]));

    render(
      <BrowserRouter>
        <Nomina />
      </BrowserRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nómina' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Calcular liquidación' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Liquidaciones' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Resumen' }),
    ).toBeInTheDocument();
  });

  it('calcula liquidación y muestra el resultado', async () => {
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/api/nomina/conceptos')) {
        return respuestaJson([]);
      }
      if (String(url).includes('/api/nomina/calcular')) {
        return respuestaJson({
          id: 'liq-1',
          empleadoId: 'emp-1',
          periodo: '2026-11',
          salarioBase: 1500000,
          totalDevengos: 1662000,
          totalDeducciones: 120000,
          netoAPagar: 1542000,
          conceptos: [],
        });
      }
      if (String(url).includes('/api/nomina/liquidaciones')) {
        return respuestaJson([]);
      }
      return Promise.resolve(new Response('Not found', { status: 404 }));
    });

    render(
      <BrowserRouter>
        <Nomina />
      </BrowserRouter>,
    );

    // Llenar formulario
    fireEvent.change(document.getElementById('empleadoId')!, {
      target: { value: 'emp-1' },
    });
    fireEvent.change(document.getElementById('periodo')!, {
      target: { value: '2026-11' },
    });
    fireEvent.change(document.getElementById('salarioBase')!, {
      target: { value: '1500000' },
    });

    // Hacer clic en calcular
    fireEvent.click(screen.getByRole('button', { name: 'Calcular liquidación' }));

    await waitFor(() =>
      expect(screen.findByText('$ 1.542.000,00')).toBeInTheDocument(),
    );
  });
});
