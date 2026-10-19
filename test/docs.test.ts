import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import ts from 'typescript';

/** Every source file under `dir`, skipping the generated widget bundles. */
function sourceFiles(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      return name === 'generated' ? [] : sourceFiles(file);
    }
    return /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts') ? [file] : [];
  });
}

/** What a statement exports, by name, or an empty list if it exports nothing. */
function exportedNames(statement: ts.Statement): readonly string[] {
  const modifiers = ts.canHaveModifiers(statement)
    ? (ts.getModifiers(statement) ?? [])
    : [];
  const exported = modifiers.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  );
  if (!exported) {
    return [];
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((d) => d.name.getText());
  }
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement)
  ) {
    return [statement.name?.getText() ?? 'default'];
  }
  return [];
}

/** The exports in `file` that have no `/** … *\/` doc comment above them. */
function undocumentedExports(file: string): readonly string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  return source.statements
    .filter((statement) => ts.getJSDocCommentsAndTags(statement).length === 0)
    .flatMap((statement) =>
      exportedNames(statement).map(
        (name) => `${path.relative(process.cwd(), file)}: ${name}`,
      ),
    );
}

describe('documentation', () => {
  it('has a doc comment on every export in src, so the code explains itself', () => {
    const missing = sourceFiles(path.join(process.cwd(), 'src')).flatMap(
      undocumentedExports,
    );
    expect(missing).toEqual([]);
  });
});
