import { createRequire } from 'module'
import { describe, expect, it } from 'vitest'
import { generate } from '../src/generator'

type TsModule = typeof import('typescript')

const requireModule = createRequire(__filename)
const variants: Array<{ label: string, ts: TsModule }> = [
  { label: 'TypeScript 3.9', ts: requireModule('typescript') as TsModule },
  { label: 'TypeScript 4.9', ts: requireModule('typescript-4-9') as TsModule },
  { label: 'TypeScript 5.9', ts: requireModule('typescript-5-9') as TsModule }
]

const expressions = [
  { label: 'object', content: 'export default {}' },
  {
    label: 'object with spreads and const assertion',
    content: 'const common = { title: "test" }; export default { ...common } as const'
  },
  { label: 'array', content: 'export default [1, 2] as const' },
  { label: 'string literal', content: 'export default \'text; "value"\'' },
  { label: 'number literal', content: 'export default 42' },
  { label: 'boolean literal', content: 'export default true' },
  { label: 'null', content: 'export default null' },
  { label: 'arrow function', content: 'export default () => ({})' },
  { label: 'call', content: 'const createLocale = () => ({}); export default createLocale()' },
  { label: 'parenthesized identifier', content: 'const locale = {}; export default (locale)' },
  { label: 'type assertion', content: 'const locale = {}; export default locale as Record<string, unknown>' },
  { label: 'anonymous function', content: 'export default function () {}' },
  { label: 'anonymous class', content: 'export default class {}' },
  { label: 'default re-export', content: 'export { default } from "./other"' }
]

for (const { label, ts } of variants) {
  const syntaxDiagnostics = (content: string): string[] => {
    const source = ts.createSourceFile('index.ts', content, ts.ScriptTarget.Latest, true)
    return ts.createProgram([], {}).getSyntacticDiagnostics(source)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
  }

  describe(`${label} default exports`, () => {
    for (const expression of expressions) {
      it(`generates valid exports for ${expression.label}`, () => {
        const { content } = generate(ts, [{ path: 'locales/zh-CN.ts', content: expression.content }])
        expect(syntaxDiagnostics(content)).toEqual([])
        expect(content).toContain('export { default as zh_CN } from \'./locales/zh-CN\'')
      })
    }

    it('preserves an identifier default export name', () => {
      const { content } = generate(ts, [{
        path: 'locales/zh-CN.ts',
        content: 'const locale = {}; export default locale'
      }])
      expect(syntaxDiagnostics(content)).toEqual([])
      expect(content).toContain('export { default as locale } from \'./locales/zh-CN\'')
    })

    it('preserves a named default class', () => {
      const { content } = generate(ts, [{
        path: 'locales/zh-CN.ts',
        content: 'export default class Locale {}'
      }])
      expect(syntaxDiagnostics(content)).toEqual([])
      expect(content).toContain('export { default as Locale } from \'./locales/zh-CN\'')
    })

    for (const [fileName, alias] of [
      ['locale', 'locale'],
      ['zh CN', 'zh_CN'],
      ['123-locale', '_123_locale'],
      ['舞蹈練習', '舞蹈練習'],
      ['鏡像翻跳', '鏡像翻跳'],
      ['$locale', '$locale'],
      ['a\u{200C}b', label === 'TypeScript 5.9' ? 'a\u{200C}b' : 'a_b'],
      ['a\u{200D}b', label === 'TypeScript 5.9' ? 'a\u{200D}b' : 'a_b'],
      ['\u{1E4D0}locale', label === 'TypeScript 5.9' ? '\u{1E4D0}locale' : '_locale']
    ]) {
      it(`generates a valid filename alias for ${fileName}`, () => {
        const { content } = generate(ts, [{ path: `${fileName}.ts`, content: 'export default {}' }])
        expect(syntaxDiagnostics(content)).toEqual([])
        expect(content).toContain(`export { default as ${alias} }`)
      })
    }

    it('generates a valid alias for an external file', () => {
      const { content } = generate(ts, [{ path: 'locales/zh-CN.json', content: '{}' }])
      expect(syntaxDiagnostics(content)).toEqual([])
      expect(content).toContain('export { default as zh_CN } from \'./locales/zh-CN.json\'')
    })

    if (label !== 'TypeScript 3.9') {
      it('generates a valid export for a satisfies expression', () => {
        const { content } = generate(ts, [{
          path: 'locales/zh-CN.ts',
          content: 'export default { title: "test" } as const satisfies Record<string, string>'
        }])
        expect(syntaxDiagnostics(content)).toEqual([])
        expect(content).toContain('export { default as zh_CN } from \'./locales/zh-CN\'')
      })
    }
  })
}
