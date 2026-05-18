import { createRequire } from 'module'
import { describe, expect, it } from 'vitest'
import { guessIsType, analyzeExports } from '../src/analyze'
import { getSingleFileProgram } from '../src/parser'

const requireModule = createRequire(__filename)

type TsModule = typeof import('typescript')

const loadTypeScript = (specifier: string): TsModule =>
  requireModule(specifier) as TsModule

const typeScriptVariants: Array<{ label: string, ts: TsModule }> = [
  { label: 'TypeScript 3.9', ts: loadTypeScript('typescript') },
  { label: 'TypeScript 4.9', ts: loadTypeScript('typescript-4-9') },
  { label: 'TypeScript 5.9', ts: loadTypeScript('typescript-5-9') }
]

const getExportsOf = (ts: TsModule, content: string, fileName = 'test.ts') => {
  const fileProgram = getSingleFileProgram(ts, fileName, content)
  const typeChecker = fileProgram.program.getTypeChecker()
  const moduleSymbol = typeChecker.getSymbolAtLocation(fileProgram.ast)!
  return { fileProgram, typeChecker, exports: moduleSymbol.exports! }
}

for (const { label, ts } of typeScriptVariants) {
  describe(label, () => {
    describe('guessIsType', () => {
      describe('ExportAssignment (export default ...)', () => {
        it('does not crash on export default object literal (non-alias)', () => {
          const { typeChecker, exports } = getExportsOf(ts, `
            import foo from './foo'
            export default {
              ...foo,
              key: 'value'
            } as const
          `)
          const defaultSymbol = exports.get('default' as ts.__String)!
          expect(() => guessIsType(ts, typeChecker, defaultSymbol)).not.toThrow()
        })

        it('returns false for export default object literal (non-alias)', () => {
          const { typeChecker, exports } = getExportsOf(ts, `
            import foo from './foo'
            export default {
              ...foo,
              key: 'value'
            } as const
          `)
          const defaultSymbol = exports.get('default' as ts.__String)!
          expect(guessIsType(ts, typeChecker, defaultSymbol)).toBe(false)
        })

        it('returns false for export default variable reference (alias, not a type)', () => {
          const { typeChecker, exports } = getExportsOf(ts, `
            const locale = { key: 'value' } as const
            export default locale
          `)
          const defaultSymbol = exports.get('default' as ts.__String)!
          expect(guessIsType(ts, typeChecker, defaultSymbol)).toBe(false)
        })

        it('returns true for export default type alias reference', () => {
          const { typeChecker, exports } = getExportsOf(ts, `
            type MyType = string
            export default MyType
          `)
          const defaultSymbol = exports.get('default' as ts.__String)!
          expect(guessIsType(ts, typeChecker, defaultSymbol)).toBe(true)
        })
      })

      describe('ExportSpecifier (export { X })', () => {
        it('returns false for exported value', () => {
          const { typeChecker, exports } = getExportsOf(ts, `
            const foo = 1
            export { foo }
          `)
          const fooSymbol = exports.get('foo' as ts.__String)!
          expect(guessIsType(ts, typeChecker, fooSymbol)).toBe(false)
        })

        it('returns true for exported type alias', () => {
          const { typeChecker, exports } = getExportsOf(ts, `
            type Foo = string
            export { Foo }
          `)
          const fooSymbol = exports.get('Foo' as ts.__String)!
          expect(guessIsType(ts, typeChecker, fooSymbol)).toBe(true)
        })

        it('returns true for exported interface', () => {
          const { typeChecker, exports } = getExportsOf(ts, `
            interface Bar { x: number }
            export { Bar }
          `)
          const barSymbol = exports.get('Bar' as ts.__String)!
          expect(guessIsType(ts, typeChecker, barSymbol)).toBe(true)
        })
      })
    })

    describe('analyzeExports', () => {
      it('does not crash on file with export default object literal', () => {
        const content = `
          import common from './common.json'
          import extra from './extra.json'
          export default {
            ...common,
            ...extra
          } as const
        `
        const fileProgram = getSingleFileProgram(ts, 'locale.ts', content)
        expect(() => analyzeExports(ts, fileProgram, null)).not.toThrow()
      })

      it('marks export default object literal as non-type', () => {
        const content = `
          import common from './common.json'
          export default {
            ...common,
            key: 'value'
          } as const
        `
        const fileProgram = getSingleFileProgram(ts, 'locale.ts', content)
        const result = analyzeExports(ts, fileProgram, null)
        const defaultExport = result.find(e => e.default)
        expect(defaultExport).toBeDefined()
        expect(defaultExport!.isTypeOnly).toBe(false)
      })

      it('marks export default variable as non-type', () => {
        const content = `
          const locale = { key: 'value' } as const
          export default locale
        `
        const fileProgram = getSingleFileProgram(ts, 'locale.ts', content)
        const result = analyzeExports(ts, fileProgram, null)
        const defaultExport = result.find(e => e.default)
        expect(defaultExport).toBeDefined()
        expect(defaultExport!.isTypeOnly).toBe(false)
      })
    })
  })
}
