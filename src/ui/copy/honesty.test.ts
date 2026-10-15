/**
 * B-56 — the app may name a transmission, a filing at ANAF or a connection **only in order to deny one**.
 *
 * Every defect in this family has the same shape: a sentence that says the app did something it never
 * did. `Declarația … a fost transmisă` sat over a plain `setData` call; `Contul este conectat la
 * platforma e-Factura` sat on a card with no connect action, no client and no network layer anywhere in
 * the app; a status label read `Transmise` for a state nothing produces; a security card promised an SMS
 * code the app has no way to send. A person who believes a declaration left this device may simply not
 * file it, which is why this is pinned rather than left to review.
 *
 * The rule cannot be a plain blocklist, because honest copy has to mention these words: art. 10 alin. (7)
 * OUG 120/2021 is a deadline for *transmitting* an invoice, and the app has to be able to say that a
 * change „nu constituie nicio declarație transmisă către ANAF”. So the rule is: a literal that names a
 * transmission or a connection must also carry a negation. A claim with no denial in the sentence is a
 * claim the app is making about itself.
 *
 * Sources come in through Vite's raw glob and are parsed with the TypeScript AST — the same choice as
 * `copy.guard.test.ts`, so comments and property names are never mistaken for user-visible text.
 */
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { documents, eFactura, recordStatus } from './records';
import { settings } from './settings';

const COPY = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SURFACES = import.meta.glob('../../{components,pages}/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path);

const copyFiles = Object.keys(COPY).filter(p => !isTest(p)).sort();
const surfaces = Object.keys(SURFACES).filter(p => !isTest(p)).sort();

/**
 * A literal that says an operation on an external system happened, is happening, or is about to happen.
 * Deliberately narrow: `transmitere` / `transmiți` (the person's own act, and the subject of the legal
 * deadline) are not claims about this app, while `transmisă` / `Transmise` are.
 */
const CLAIM =
  /\btransmis|conectat|conectare|conecteaz|retransmite|prin SMS|se trimite|trimite aplica[țt]ia|î[țt]i (va|vor|vom) trimite|v[ăa] (va|vor|vom) trimite/i;

/** A negation in the same sentence — the only company a claim is allowed to keep. */
const DENIAL = /\bnu\b|\bf[ăa]r[ăa]\b|nicio|nimic|neconectat|niciodat[ăa]|deloc/i;

const isFalseClaim = (text: string): boolean => CLAIM.test(text) && !DENIAL.test(text);

interface Literal {
  text: string;
  line: number;
}

function literals(path: string, source: string): Literal[] {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Literal[] = [];
  const lineAt = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  const isModuleSpecifier = (node: ts.Node): boolean => {
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
    if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return true;
    return false;
  };

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isModuleSpecifier(node)) found.push({ text: node.text, line: lineAt(node.pos) });
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      // `${nr} a fost retransmisă către e-Factura` is a TemplateExpression, not a literal — its fixed
      // parts still reach the screen, so they are scanned too.
      const text = node.getText().replace(/[$`{}]/g, ' ').trim();
      if (text) found.push({ text, line: lineAt(node.pos) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('B-56 — the app never claims an operation it does not perform', () => {
  it('scans enough of the tree for the rule to mean anything', () => {
    expect(copyFiles.length).toBeGreaterThan(5);
    expect(surfaces.length).toBeGreaterThan(20);
    let scanned = 0;
    for (const file of [...copyFiles, ...surfaces]) scanned += literals(file, (COPY[file] ?? SURFACES[file])).length;
    expect(scanned).toBeGreaterThan(200);
  });

  it('the rule catches the sentences this defect actually wrote', () => {
    // Guards the guard: if the regexes drift, the sweep below turns green without meaning anything.
    expect(isFalseClaim('Contul este conectat la platforma e-Factura')).toBe(true);
    expect(isFalseClaim('Declarația pentru 2026 a fost transmisă')).toBe(true);
    expect(isFalseClaim('Facturile transmise către e-Factura vor apărea aici.')).toBe(true);
    expect(isFalseClaim('Retransmite')).toBe(true);
    expect(isFalseClaim('Pentru modificări îți vom trimite un cod de securitate prin SMS.')).toBe(true);
    // …and leaves the honest ones alone.
    expect(isFalseClaim('Ea nu constituie nicio declarație transmisă către ANAF.')).toBe(false);
    expect(isFalseClaim('Nimic nu se trimite la ANAF: obligația este de păstrare.')).toBe(false);
    expect(isFalseClaim('Aplicația nu este conectată la sistemul e-Factura.')).toBe(false);
    expect(isFalseClaim('Neconectat')).toBe(false);
    expect(isFalseClaim('art. 155 alin. (1) lit. h) trimite la art. 114')).toBe(false);
  });

  it('no copy or surface states a transmission, a filing at ANAF or a connection without denying it', () => {
    const violations: string[] = [];
    for (const file of [...copyFiles, ...surfaces]) {
      const source = COPY[file] ?? SURFACES[file];
      for (const lit of literals(file, source)) {
        if (isFalseClaim(lit.text)) {
          violations.push(`${file}:${lit.line}  „${lit.text.replace(/\s+/g, ' ').slice(0, 110)}”`);
        }
      }
    }
    expect(violations, 'the app claims an operation it does not perform').toEqual([]);
  });

  it('the e-Factura card and page say the app is not connected', () => {
    expect(settings.eFactura.notConnected).toMatch(/nu este conectat/);
    expect(settings.eFactura.notConnectedBadge).toMatch(/neconectat/i);
    expect(eFactura.subtitle).toMatch(/nu este conectat/);
    // The preference is a note to the person, not a sending rule the app obeys.
    expect(settings.eFactura.sendingHint).toMatch(/nu trimite nimic/);
  });

  it('no stored-record label reads as a transmission', () => {
    // `transmisa` survives in storage vocabulary but has no producer and no renderer; the word that
    // described it on screen claimed an external system had received something.
    expect(recordStatus.tabs).not.toHaveProperty('transmisa');
    expect(recordStatus.labels).not.toHaveProperty('transmisa');
  });

  it('the security cards promise no SMS the app cannot send', () => {
    expect(settings.security.bankBody).toMatch(/nu .*trimite.*SMS/);
    expect(settings.security.personalBody).toMatch(/nu .*trimite.*SMS/);
  });
});

describe('B-62 — the document sections name the forms they really are', () => {
  it('D100 is the obligations-to-the-state-budget return, not an income-tax declaration', () => {
    expect(documents.sections.im.desc).toContain('obligații de plată la bugetul de stat');
    expect(documents.sections.im.desc).toContain('14.13.01.99/bs');
    expect(documents.sections.im.desc).not.toMatch(/impozit pe venit/);
  });

  it('D220 is the estimated-income declaration, not a social-contributions document', () => {
    expect(documents.sections.cs.desc).toContain('venitul estimat');
    expect(documents.sections.cs.desc).not.toMatch(/contribu[țt]ii sociale/);
  });

  it('the form numbers themselves are not renumbered', () => {
    expect(documents.sections.im.desc).toContain('Declarația 100');
    expect(documents.sections.cs.desc).toContain('Declarația 220');
    expect(documents.sections.tva.desc).toContain('Declarația 300');
  });
});
