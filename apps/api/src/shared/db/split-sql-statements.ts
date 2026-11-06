type SqlState = 'sql' | 'single-quote' | 'double-quote' | 'line-comment' | 'block-comment' | 'dollar-quote';

function matchDollarTag(script: string, index: number): string | undefined {
  if (script.charAt(index + 1) === '$') {
    return '$$';
  }

  const match = /^\$[A-Za-z_][A-Za-z0-9_]*\$/.exec(script.slice(index));
  return match?.[0];
}

export function splitSqlStatements(script: string): string[] {
  const statements: string[] = [];
  let current = '';
  let index = 0;
  let state: SqlState = 'sql';
  let dollarTag = '';

  while (index < script.length) {
    const char = script.charAt(index);
    const next = script.charAt(index + 1);

    if (state === 'line-comment') {
      current += char;

      if (char === '\n') {
        state = 'sql';
      }

      index += 1;
      continue;
    }

    if (state === 'block-comment') {
      current += char;

      if (char === '*' && next === '/') {
        current += '/';
        state = 'sql';
        index += 2;
      } else {
        index += 1;
      }

      continue;
    }

    if (state === 'single-quote') {
      current += char;

      if (char === "'") {
        if (next === "'") {
          current += next;
          index += 2;
        } else {
          state = 'sql';
          index += 1;
        }
      } else {
        index += 1;
      }

      continue;
    }

    if (state === 'double-quote') {
      current += char;

      if (char === '"') {
        if (next === '"') {
          current += next;
          index += 2;
        } else {
          state = 'sql';
          index += 1;
        }
      } else {
        index += 1;
      }

      continue;
    }

    if (state === 'dollar-quote') {
      if (script.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        state = 'sql';
      } else {
        current += char;
        index += 1;
      }

      continue;
    }

    if (char === '-' && next === '-') {
      current += '--';
      state = 'line-comment';
      index += 2;
      continue;
    }

    if (char === '/' && next === '*') {
      current += '/*';
      state = 'block-comment';
      index += 2;
      continue;
    }

    if (char === "'") {
      current += char;
      state = 'single-quote';
      index += 1;
      continue;
    }

    if (char === '"') {
      current += char;
      state = 'double-quote';
      index += 1;
      continue;
    }

    if (char === '$') {
      const tag = matchDollarTag(script, index);

      if (tag) {
        dollarTag = tag;
        current += tag;
        state = 'dollar-quote';
        index += tag.length;
        continue;
      }
    }

    if (char === ';') {
      const statement = current.trim();

      if (statement !== '') {
        statements.push(statement);
      }

      current = '';
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  const statement = current.trim();

  if (statement !== '') {
    statements.push(statement);
  }

  return statements;
}
