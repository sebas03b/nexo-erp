import { describe, expect, it } from 'vitest';

import { splitSqlStatements } from './split-sql-statements.js';

describe('splitSqlStatements', () => {
  it('separa múltiples sentencias SQL', () => {
    const statements = splitSqlStatements(`
      CREATE TABLE usuarios (id uuid PRIMARY KEY);
      CREATE TABLE clientes (id uuid PRIMARY KEY);
    `);

    expect(statements).toEqual([
      'CREATE TABLE usuarios (id uuid PRIMARY KEY)',
      'CREATE TABLE clientes (id uuid PRIMARY KEY)',
    ]);
  });

  it('no separa por punto y coma dentro de strings, identificadores o bloques dollar-quoted', () => {
    const statements = splitSqlStatements(`
      INSERT INTO auditoria (detalle) VALUES ('uno; dos');
      SELECT "columna;especial" FROM auditoria;
      DO $$ BEGIN PERFORM 'tres; cuatro'; END $$;
    `);

    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain("'uno; dos'");
    expect(statements[1]).toContain('"columna;especial"');
    expect(statements[2]).toContain("'tres; cuatro'");
  });

  it('ignora puntos y coma dentro de comentarios', () => {
    const statements = splitSqlStatements(`
      -- comentario con ; interno
      SELECT 1;
      /* otro ; comentario */
      SELECT 2;
    `);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('SELECT 1');
    expect(statements[1]).toContain('SELECT 2');
  });
});
