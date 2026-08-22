import { unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TypeScriptAdapter } from '../../src/adapters/language/TypeScriptAdapter.js'
import { NoAssertionRule } from '../../src/rules/NoAssertion.js'
import { TrivialAssertionRule } from '../../src/rules/TrivialAssertion.js'

const fixturesDir = join(import.meta.dirname, '../../../fixtures')
const tmpFile = join(fixturesDir, '__tmp_ast_regression.test.ts')

function writeTmpTest(source: string): void {
  writeFileSync(tmpFile, source)
}

function cleanupTmp(): void {
  try {
    unlinkSync(tmpFile)
  } catch {
    // ignore
  }
}

describe('AST analysis regressions (Task 4-C bugs B-1..B-8)', () => {
  const adapter = new TypeScriptAdapter()
  const noAssertion = new NoAssertionRule(adapter)
  const trivial = new TrivialAssertionRule(adapter)

  afterEach(() => cleanupTmp())

  it('B-1: detects expect(x).not.toBeNull() as a meaningful assertion (not no-assertion)', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('x', () => {
        it('uses .not. matcher', () => {
          const result = compute();
          expect(result).not.toBeNull();
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0) // should NOT flag as no-assertion
  })

  it('B-2: detects expect(x).resolves.toBe(...) as a meaningful assertion', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('async', () => {
        it('resolves to value', async () => {
          await expect(fetchUser()).resolves.toEqual({ id: 1 });
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('B-2: detects expect(x).rejects.toThrow(...) as a meaningful assertion', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('async', () => {
        it('rejects with error', async () => {
          await expect(badFn()).rejects.toThrow('fail');
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('B-3: handles it.each([...])("name", fn) — visits the test', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('each', () => {
        it.each([1, 2, 3])('works with %d', (n) => {
          expect(n).toBeGreaterThan(0);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('B-3: it.each with no assertions still flags', () => {
    writeTmpTest(`
      import { describe, it } from 'vitest';
      describe('each', () => {
        it.each([1, 2, 3])('no assert %d', (n) => {
          // nothing
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBeGreaterThan(0)
  })

  it('B-4: it.todo() does NOT count toward denominator (no finding)', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('mixed', () => {
        it('real test', () => {
          expect(1).toBe(1);
        });
        it.todo('todo test');
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('B-4: it.skip() does NOT count toward denominator', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('mixed', () => {
        it.skip('skipped test', () => {});
        it('real test', () => {
          expect(1).toBe(1);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('B-5: expectTypeOf<T>() is detected as a meaningful assertion (type test)', () => {
    writeTmpTest(`
      import { describe, it, expectTypeOf } from 'vitest';
      type User = { id: string; name: string };
      describe('User type', () => {
        it('has the right shape', () => {
          expectTypeOf<User>().toMatchTypeOf<{ id: string; name: string }>();
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0) // should NOT flag as no-assertion
  })

  it('B-6: expect.assertions(0) is NOT counted as meaningful', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('race condition', () => {
        it('does not throw', () => {
          expect.assertions(0);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    // expect.assertions(0) does not verify an observable outcome and is flagged.
    // See docs/rules/no-assertion.md for the documented edge case.
    expect(findings.length).toBe(1)
  })

  it('B-6: expect.assertions(N) where N>0 IS counted as meaningful', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('explicit count', () => {
        it('calls api exactly once', () => {
          expect.assertions(1);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('B-7: expect.hasAssertions() is detected as meaningful', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('explicit guard', () => {
        it('has assertions', () => {
          expect.hasAssertions();
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('B-8: a rule crash does NOT inflate the AQ score (visitor try/catch)', () => {
    // This test verifies the try/catch in analyzeAssertions — passing weird input
    // should not crash but return empty results.
    const weirdSource = `
      import { describe, it } from 'vitest';
      describe('weird', () => {
        it('has malformed content', () => {
          // Some content that might confuse the visitor
          const x = { }['nonexistent'];
        });
      });
    `
    writeTmpTest(weirdSource)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    // Should not throw — should return findings (likely 1 for no-assertion)
    expect(() => {
      noAssertion.run({ file, inDiff: true, coverage: null, runner: 'vitest', log: () => {} })
    }).not.toThrow()
  })

  it('TrivialAssertion: expect(x).not.toBeNull() is NOT trivial (uses .not.)', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('not', () => {
        it('rejects null', () => {
          const x = compute();
          expect(x).not.toBeNull();
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = trivial.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    // Per spec §3.2, when trivial matchers are used with .not. prefix,
    // they're no longer trivial — they actually check something.
    // So expect(x).not.toBeNull() should produce 0 trivial findings.
    expect(findings.length).toBe(0)
  })

  it('NB-1: expect.soft(x).toBe(y) is a meaningful assertion (not no-assertion)', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('soft', () => {
        it('softly asserts', () => {
          expect.soft(1 + 1).toBe(2);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('NB-1: assert(cond) is a meaningful assertion (node assert)', () => {
    writeTmpTest(`
      import assert from 'node:assert';
      import { describe, it } from 'vitest';
      describe('assert-style', () => {
        it('asserts with node assert', () => {
          assert(true);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('NB-1: assert.equal(a, b) is a meaningful assertion', () => {
    writeTmpTest(`
      import assert from 'node:assert';
      import { describe, it } from 'vitest';
      describe('assert-style', () => {
        it('asserts equality', () => {
          assert.equal(1 + 1, 2);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('NB-1: fc.assert(fc.property(...)) is a meaningful assertion (fast-check)', () => {
    writeTmpTest(`
      import * as fc from 'fast-check';
      import { describe, it } from 'vitest';
      describe('property', () => {
        it('holds the property', () => {
          fc.assert(fc.property(fc.integer(), (n) => n + 1 > n));
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('NB-3: it.skipIf(cond)("name", fn) with assertions is not flagged', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      const cond = process.env.CI === 'true';
      describe('conditional', () => {
        it.skipIf(cond)('runs only locally', () => {
          expect(localOnly()).toBeTruthy();
        });
        it.runIf(!cond)('runs only in CI', () => {
          expect(ciOnly()).toBeTruthy();
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('NB-3: it.runIf(cond)("name", fn) without assertions still flags', () => {
    writeTmpTest(`
      import { describe, it } from 'vitest';
      const cond = process.env.CI === 'true';
      describe('conditional', () => {
        it.runIf(cond)('no assertions here', () => {
          doSomething();
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(1)
  })

  it('NB-3: it.skipIf(cond)("name", fn) is treated as skipped (no finding)', () => {
    writeTmpTest(`
      import { describe, it } from 'vitest';
      const cond = process.env.CI === 'true';
      describe('conditional', () => {
        it.skipIf(cond)('skips conditionally', () => {
          doSomething();
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('NB-2: it("name", { concurrent: true }, fn) options-object is analyzed (no-assertion flags)', () => {
    writeTmpTest(`
      import { describe, it } from 'vitest';
      describe('concurrent', () => {
        it('runs concurrently', { concurrent: true }, () => {
          // no assertions — should be flagged
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(1)
  })

  it('NB-8: expect(promise).resolves.toBeDefined() is NOT trivial', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('promises', () => {
        it('resolves to something defined', async () => {
          await expect(fetchThing()).resolves.toBeDefined();
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = trivial.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('B-9: expect(a + b).toBe(a + b) is a tautology (trivial)', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('math', () => {
        it('self compares', () => {
          const a = 1, b = 2;
          expect(a + b).toBe(a + b);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = trivial.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(1)
  })

  it('B-9: expect(x).toEqual(x) is a tautology (trivial)', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('obj', () => {
        it('self equals', () => {
          const x = { a: 1 };
          expect(x).toEqual(x);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = trivial.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(1)
  })

  it('B-9: expect(a + b).toBe(c) is NOT a tautology', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('math', () => {
        it('compares different expressions', () => {
          const a = 1, b = 2, c = 3;
          expect(a + b).toBe(c);
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = trivial.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('B-9: expect(typeof x).toBe("string") is NOT trivial', () => {
    writeTmpTest(`
      import { describe, it, expect } from 'vitest';
      describe('types', () => {
        it('checks the type string', () => {
          const x = compute();
          expect(typeof x).toBe('string');
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = trivial.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('external regression: an empty template title produces a stable finding name', () => {
    writeTmpTest(`
      import { describe, it } from 'vitest';
      describe('generated title', () => {
        it(\`\`, () => {
          doSomething();
        });
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].testName).toBe('<dynamic test title>')
  })

  it('external regression: Ava t.is() is counted as a meaningful assertion', () => {
    writeTmpTest(`
      import test from 'ava';
      test('keeps a real assertion', (t) => {
        t.is(slugify('Hello world'), 'hello-world');
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    expect(file.runner).toBe('ava')
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'ava',
      log: () => {},
    })
    expect(findings).toHaveLength(0)
  })

  it('external regression: util.assertEqual type helpers are meaningful assertions', () => {
    writeTmpTest(`
      import { test } from 'vitest';
      const util = { assertEqual: <T, U>(_value: true) => undefined };
      test('checks inferred type', () => {
        util.assertEqual<string, string>(true);
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings).toHaveLength(0)
  })

  it('external regression: expect.element() is a meaningful Vitest Browser assertion', () => {
    writeTmpTest(`
      import { test, expect } from 'vitest';
      test('renders expected text', async () => {
        await expect.element(page.getByRole('button')).toMatchTextContent('Save');
      });
    `)
    const file = adapter.parseFile(tmpFile, fixturesDir)!
    const findings = noAssertion.run({
      file,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings).toHaveLength(0)
  })
})
