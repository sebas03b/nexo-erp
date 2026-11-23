import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { Kysely, PGliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SqlFileMigrationProvider } from '../../shared/db/sql-file-migration.provider.js';
import type { Database } from '../../shared/db/schema.js';
import { UnitOfWork } from '../../shared/db/unit-of-work.js';
import { InMemoryEventBus } from '../../shared/events/event-bus.js';
import type { AppEventMap } from '../../shared/events/event-map.js';
import { Outbox, type OutboxWriter } from '../../shared/events/outbox.js';
import { CitasRepository } from './citas.repository.js';
import { CitasService } from './citas.service.js';
import type { CitaDetalle } from './citas.types.js';
import type {
  ConsultorEmpleadosParaCita,
  VerificadorClienteParaCita,
} from './ports.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

class CitasRepositoryConBarrera extends CitasRepository {
  #llegadas = 0;
  #resolverLiberar: (() => void) | undefined;
  readonly #liberar: Promise<void>;

  constructor(db: Kysely<Database>) {
    super(db);
    this.#liberar = new Promise<void>((resolve) => {
      this.#resolverLiberar = () => resolve();
    });
  }

  override async obtenerCita(id: string): Promise<CitaDetalle | null> {
    const cita = await super.obtenerCita(id);
    this.#llegadas += 1;

    if (this.#llegadas === 2) {
      this.#resolverLiberar?.();
    }

    await this.#liberar;
    return cita;
  }
}

describe('CitasService', () => {
  let db: Kysely<Database>;
  let citaId: string;

  beforeAll(async () => {
    const pglite = new PGlite();
    db = new Kysely<Database>({
      dialect: new PGliteDialect({ pglite }),
    });

    const migrator = new Migrator({
      db,
      provider: new SqlFileMigrationProvider(MIGRATIONS_DIRECTORY),
    });
    const { error } = await migrator.migrateToLatest();
    if (error) {
      throw new Error('No se pudieron aplicar las migraciones de prueba', {
        cause: error,
      });
    }
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.deleteFrom('citas').execute();
    await db.deleteFrom('empleados').execute();
    await db.deleteFrom('clientes').execute();
    await db.deleteFrom('outbox_events').execute();

    const cliente = await db
      .insertInto('clientes')
      .values({
        nombre: 'Ana González',
        documento: '12345678',
        email: 'ana@example.com',
        telefono: '3001112233',
        canal_preferido: 'email',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const empleado = await db
      .insertInto('empleados')
      .values({
        nombre: 'Laura Pérez',
        email: null,
        telefono: null,
        activo: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const cita = await db
      .insertInto('citas')
      .values({
        cliente_id: cliente.id,
        empleado_id: empleado.id,
        inicio: new Date('2026-11-25T15:00:00.000Z'),
        fin: new Date('2026-11-25T16:00:00.000Z'),
        motivo: 'Corte y color',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    citaId = cita.id;
  });

  function crearServicio(
    repository: CitasRepository,
    unitOfWork: UnitOfWork<AppEventMap>,
  ): CitasService {
    const clientes: VerificadorClienteParaCita = {
      existe: async (id, executor) => {
        const cliente = await executor
          .selectFrom('clientes')
          .select('id')
          .where('id', '=', id)
          .executeTakeFirst();
        return cliente !== undefined;
      },
    };
    const empleados: ConsultorEmpleadosParaCita = {
      obtenerEmpleado: async (id, executor) => {
        const empleado = await executor
          .selectFrom('empleados')
          .select(['id', 'nombre', 'activo'])
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        return empleado ?? null;
      },
    };

    return new CitasService(repository, unitOfWork, clientes, empleados);
  }

  it('devuelve CONFLICTO_ESTADO_CITA cuando dos confirmaciones usan el mismo estado esperado', async () => {
    const eventBus = new InMemoryEventBus<AppEventMap>();
    let eventosRecibidos = 0;
    eventBus.subscribe('CitaConfirmada', () => {
      eventosRecibidos += 1;
    });
    const repository = new CitasRepositoryConBarrera(db);
    const unitOfWork = new UnitOfWork<AppEventMap>(db, eventBus);
    const service = crearServicio(repository, unitOfWork);

    const resultados = await Promise.allSettled([
      service.confirmarCita(citaId),
      service.confirmarCita(citaId),
    ]);

    expect(resultados.filter((resultado) => resultado.status === 'fulfilled')).toHaveLength(
      1,
    );

    let razon: unknown;
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        razon = resultado.reason;
      }
    }
    expect(razon).toMatchObject({
      code: 'CONFLICTO_ESTADO_CITA',
      statusCode: 409,
    });

    const persistida = await db
      .selectFrom('citas')
      .select('estado')
      .where('id', '=', citaId)
      .executeTakeFirstOrThrow();
    expect(persistida.estado).toBe('Confirmada');

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.tipo).toBe('CitaConfirmada');
    expect(eventosRecibidos).toBe(1);
  });

  it('revierte estado y Outbox si falla después de publicar CitaConfirmada', async () => {
    const eventBus = new InMemoryEventBus<AppEventMap>();
    let eventosRecibidos = 0;
    eventBus.subscribe('CitaConfirmada', () => {
      eventosRecibidos += 1;
    });
    const outbox = new Outbox();
    const outboxConFallo: OutboxWriter = {
      save: async (executor, event) => {
        await outbox.save(executor, event);
        throw new Error('fallo al persistir el evento');
      },
    };
    const unitOfWork = new UnitOfWork<AppEventMap>(
      db,
      eventBus,
      outboxConFallo,
    );
    const service = crearServicio(new CitasRepository(db), unitOfWork);

    await expect(service.confirmarCita(citaId)).rejects.toThrow(
      'fallo al persistir el evento',
    );

    const persistida = await db
      .selectFrom('citas')
      .select('estado')
      .where('id', '=', citaId)
      .executeTakeFirstOrThrow();
    expect(persistida.estado).toBe('Pendiente');

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos).toHaveLength(0);
    expect(eventosRecibidos).toBe(0);
  });
});
