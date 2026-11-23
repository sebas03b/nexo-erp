import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Citas } from './Citas';

interface CitaMock {
  id: string;
  clienteId: string;
  inicio: string;
  fin: string;
  estado: 'Pendiente' | 'Confirmada' | 'En Proceso' | 'Completada' | 'Cancelada';
  notas?: string;
}

describe('Agenda de Citas', () => {
  let citas: CitaMock[];

  beforeEach(() => {
    citas = [
      {
        id: 'cita-1',
        clienteId: 'cli-1',
        inicio: '2026-05-01T10:00:00.000Z',
        fin: '2026-05-01T11:00:00.000Z',
        estado: 'Pendiente',
        notas: 'Traer documentos',
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';

        if (url.endsWith('/api/clientes') && method === 'GET') {
          return Response.json([
            {
              id: 'cli-1',
              nombre: 'Ana',
              documento: '1',
              email: null,
              telefono: null,
              canalPreferido: 'email',
            },
          ]);
        }
        if (url.endsWith('/api/citas') && method === 'GET') {
          return Response.json(citas);
        }
        if (url.endsWith('/api/citas/cita-1/estado') && method === 'PATCH') {
          const body = JSON.parse(String(init?.body)) as { accion: string };
          const actual = citas[0];
          if (!actual) {
            return Response.json({ error: { message: 'No encontrada' } }, { status: 404 });
          }
          if (body.accion === 'confirmar') citas[0] = { ...actual, estado: 'Confirmada' };
          if (body.accion === 'cancelar') citas[0] = { ...actual, estado: 'Cancelada' };
          if (body.accion === 'completar' && actual.estado === 'Cancelada') {
            return Response.json(
              {
                error: {
                  code: 'TRANSICION_INVALIDA',
                  message: 'Transición de cita inválida: Cancelada → Completada',
                },
              },
              { status: 409 },
            );
          }
          return Response.json(citas[0]);
        }

        return Response.json({ error: { message: `No mock: ${method} ${url}` } }, { status: 500 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra agenda, permite transiciones y muestra error 409 de transición inválida', async () => {
    render(
      <MemoryRouter initialEntries={['/citas']}>
        <Citas />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Citas' });
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear cita' })).not.toBeInTheDocument();

    await screen.findByText('Ana');
    await screen.findByText('Traer documentos');
    await screen.findByText('Pendiente');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Confirmada');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await screen.findByText('Cancelada');

    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Transición de cita inválida: Cancelada → Completada',
      );
    });
  });
});
