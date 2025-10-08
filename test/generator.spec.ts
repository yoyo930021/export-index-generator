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
  { label: 'TypeScript 4.9', ts: loadTypeScript('typescript-4-9') }
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
  })
}
