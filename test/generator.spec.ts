import { createRequire } from 'module'
import { describe, expect, it } from 'vitest'
import { generate } from '../src/generator'
import { supportExtensions } from '../src/constant'
import fg from 'fast-glob'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const folders = ['fixture/ex1']
const requireModule = createRequire(__filename)

type TsModule = typeof import('typescript')

const loadTypeScript = (specifier: string): TsModule =>
  requireModule(specifier) as TsModule

const typeScriptVariants: Array<{ label: string, ts: TsModule }> = [
  { label: 'TypeScript 3.9', ts: loadTypeScript('typescript') },
  { label: 'TypeScript 4.9', ts: loadTypeScript('typescript-4-9') },
  { label: 'TypeScript 5.9', ts: loadTypeScript('typescript-5-9') }
]

for (const { label, ts } of typeScriptVariants) {
  describe(label, () => {
    it('generate []', () => {
      expect(generate(ts, [])).toMatchSnapshot()
    })

    for (const folder of folders) {
      it(`generate ${folder}`, () => {
        const cwd = resolve(__dirname, folder)
        const files =
          fg
            .sync(`**/*.{${supportExtensions.join(',')}}`, { cwd })
            .filter((file) => !/^index\.[jt]{1}sx{0,1}$/.test(file))
            .map((path) => ({
              path,
              content: readFileSync(resolve(cwd, path), { encoding: 'utf8' })
            }))

        expect(generate(ts, files)).toMatchSnapshot()
      })
    }

    it('should throw error when duplicate export names exist across files when --detect-duplicate is provided', () => {
      const files = [
        {
          path: 'a.ts',
          content: 'export const foo = 1;'
        },
        {
          path: 'b.ts',
          content: 'export const foo = 2;'
        }
      ]
      expect(() => generate(ts, files, true)).toThrow(/Duplicate export name/)
    })

    it('should throw error when duplicate export names exist within same file when --detect-duplicate is provided', () => {
      const files = [
        {
          path: 'duplicate.ts',
          content: `export enum GameType {}
  export enum GameType { A = 1 }`
        }
      ]
      expect(() => generate(ts, files, true)).toThrow(/Duplicate export name found: GameType/)
    })

    it('should not throw error when duplicate export names exist across files but --detect-duplicate is not provided', () => {
      const files = [
        {
          path: 'a.ts',
          content: 'export const foo = 1;'
        },
        {
          path: 'b.ts',
          content: 'export const foo = 2;'
        }
      ]
      expect(() => generate(ts, files)).not.toThrow()
    })

    it('should throw error when duplicate export names exist within same file but --detect-duplicate is not provided', () => {
      const files = [
        {
          path: 'duplicate.ts',
          content: `export enum GameType {}
  export enum GameType { A = 1 }`
        }
      ]
      expect(() => generate(ts, files)).not.toThrow()
    })
  })
}
