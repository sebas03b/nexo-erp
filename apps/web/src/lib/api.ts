interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export async function obtenerJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo obtener ${url} (${response.status})`);
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
    let mensaje = `Error ${response.status}`;

    try {
      const data = (await response.json()) as ApiErrorResponse;

      if (data.error?.message) {
        mensaje = data.error.message;
      }
    } catch {
      // La respuesta no traía un cuerpo JSON; se conserva el mensaje por defecto.
    }

    throw new Error(mensaje);
  }

  return (await response.json()) as T;
}
