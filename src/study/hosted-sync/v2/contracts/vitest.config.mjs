export default {
  root: new URL('../../../../../', import.meta.url).pathname,
  test: {
    environment: 'node',
    include: ['src/study/hosted-sync/v2/contracts/**/*.test.ts'],
  },
}
