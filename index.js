// dsh-hash-demo — minimal dsh plugin (cordis plugin, plain ESM JS, no build step).
//
// Structure mirrors the bundled dshmarket plugin:
//   - export `name`     : plugin id
//   - export `inject`   : service dependencies that must be ready before apply()
//   - export `apply(ctx)`: registers a tool into the `ctx.tools` registry
//   - `dsh.bundle.patch` (in package.json) -> cordis.patch.yml inserts this layer
//
// The `@deepseek-ai/dsh-tools` / `@deepseek-ai/cordis` imports resolve through the
// same runtime bridge the harness uses for every profile plugin, so no local
// node_modules copy is needed.

import { createHash } from 'node:crypto'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-hash-demo'
export const inject = ['tools']

const ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512']

export function apply(ctx) {
  // ctx.tools.register() returns a disposer; cordis calls it on plugin unload,
  // so the tool is auto-removed when the plugin is removed — no manual cleanup.
  ctx.tools.register(defineTool({
    name: 'hash_text',
    description:
      'Compute the cryptographic hash (MD5 / SHA1 / SHA256 / SHA512) of a text string. ' +
      'Use this whenever an exact, verifiable checksum is needed — an LLM cannot ' +
      'compute hashes reliably on its own.',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'The text to hash.',
      },
      algorithm: {
        type: 'string',
        description: `Hash algorithm. One of: ${ALGORITHMS.join(', ')}. Defaults to sha256.`,
      },
    },
    output: {
      schema: { type: 'string' },
      // Native renderer: turns the returned value into a persistable result block.
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const algo = String(args.algorithm ?? 'sha256').toLowerCase()
      if (!ALGORITHMS.includes(algo)) {
        throw new Error(
          `Unsupported algorithm "${algo}". Use one of: ${ALGORITHMS.join(', ')}.`,
        )
      }
      // Dev tip from the tutorial: log what the model actually passed in.
      console.log(`[dsh-hash-demo] hash_text called with algorithm=${algo}`)
      return createHash(algo).update(String(args.text), 'utf8').digest('hex')
    },
  }))
}
