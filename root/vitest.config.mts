import { defineConfig } from 'vitest/config'

// The root-domain Worker has no bindings and no dependencies, so it tests in
// plain node (global Request/Response) rather than the Workers pool api and
// central need.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
