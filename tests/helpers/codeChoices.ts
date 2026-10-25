/**
 * Finds the multiple-choice questions that activities build in code, so the question audit can
 * check them like the JSON banks. It reads the activity sources with the TypeScript parser and
 * collects every `shuffled([...choices], correct, r)` call and every object literal that has both
 * `choices: [...]` and a literal `correct: n`. A conditional answer (`up ? 0 : 1`) counts once per branch. Template strings are measured with each `${...}`
 * counted as a typical 6-character value (a price like "$1,250").
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

export interface CodeQuestion {
  file: string;
  line: number;
  choices: string[];
  /** Estimated display length of each choice. */
  lengths: number[];
  correct: number;
}

const PLACEHOLDER = 6;

function textOf(node: ts.Expression, src: ts.SourceFile): { text: string; len: number } | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return { text: node.text, len: node.text.length };
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    let len = node.head.text.length;
    for (const span of node.templateSpans) {
      text += '${' + span.expression.getText(src) + '}' + span.literal.text;
      len += PLACEHOLDER + span.literal.text.length;
    }
    return { text, len };
  }
  return null;
}

function literalChoices(arr: ts.Expression, src: ts.SourceFile) {
  if (!ts.isArrayLiteralExpression(arr)) return null;
  const out = arr.elements.map((e) => textOf(e as ts.Expression, src));
  return out.every((x) => x) ? (out as { text: string; len: number }[]) : null;
}

/** The answer index when it is a literal, or each branch of `cond ? 0 : 1`. */
function literalIndexes(e: ts.Expression): number[] {
  if (ts.isNumericLiteral(e)) return [Number(e.text)];
  if (ts.isParenthesizedExpression(e)) return literalIndexes(e.expression);
  if (ts.isConditionalExpression(e)) return [...literalIndexes(e.whenTrue), ...literalIndexes(e.whenFalse)];
  return [];
}

export function codeQuestions(dir: string): CodeQuestion[] {
  const found: CodeQuestion[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
    const file = path.join(dir, f);
    const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const add = (choices: { text: string; len: number }[], correct: number, at: ts.Node) =>
      found.push({ file: f, line: src.getLineAndCharacterOfPosition(at.getStart(src)).line + 1, choices: choices.map((c) => c.text), lengths: choices.map((c) => c.len), correct });
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'shuffled' && n.arguments.length >= 2) {
        const ch = literalChoices(n.arguments[0], src);
        const c = n.arguments[1];
        if (ch) for (const k of literalIndexes(c)) add(ch, k, n);
      }
      if (ts.isObjectLiteralExpression(n)) {
        const prop = (name: string) => n.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(src) === name);
        const ch = prop('choices');
        const c = prop('correct');
        const list = ch && literalChoices(ch.initializer, src);
        if (list && c) for (const k of literalIndexes(c.initializer)) add(list, k, n);
      }
      ts.forEachChild(n, visit);
    };
    visit(src);
  }
  return found;
}
