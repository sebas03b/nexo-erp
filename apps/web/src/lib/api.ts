interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

async function mensajeDeError(response: Response): Promise<string> {
  let mensaje = `Error ${response.status}`;

  try {
    const data = (await response.json()) as ApiErrorResponse;

    if (data.error?.message) {
      mensaje = data.error.message;
    }
  } catch {
    // La respuesta no traía un cuerpo JSON; se conserva el mensaje por defecto.
  }

  return mensaje;
}

export async function obtenerJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(await mensajeDeError(response));
  }

  return (await response.json()) as T;
}

export async function enviarJson<T>(
  url: string,
  method: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await mensajeDeError(response));
  }

  return (await response.json()) as T;
}

export async function eliminarRecurso(url: string): Promise<void> {
  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await mensajeDeError(response));
  }
}
