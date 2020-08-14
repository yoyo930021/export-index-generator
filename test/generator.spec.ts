import { generate } from '../src/generator'
import ts from 'typescript'
import { supportExtensions } from '../src/constant'
import fg from 'fast-glob'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const folders = ['fixture/ex1']

describe('test generator', () => {
  it('generate []', () => {
    expect(generate(ts, [])).toMatchSnapshot()
  })

  for (const folder of folders) {
    it(`generate ${folder}`, () => {
      const cwd = resolve(__dirname, folder)
      const files =
        fg
          .sync(`**/*.{${supportExtensions.join(',')}}`, { cwd }).filter((file) => !/^index\.[jt]{1}sx{0,1}$/.test(file))
          .map((path) => ({ path, content: readFileSync(resolve(cwd, path), { encoding: 'utf8' }) }))

      expect(generate(ts, files)).toMatchSnapshot()
    })
  }
})
