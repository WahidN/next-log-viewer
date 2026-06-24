import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts', 'server/index': 'src/server/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    target: 'node18',
  },
  {
    entry: { 'ui/index': 'src/ui/index.ts' },
    format: ['esm'],
    dts: true,
    clean: false,
    external: ['react', 'react-dom'],
    banner: { js: '"use client";' },
  },
])
