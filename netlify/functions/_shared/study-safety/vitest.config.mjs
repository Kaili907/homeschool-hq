export default {
  test: {
    environment: 'node',
    include: [
      'netlify/functions/_shared/study-safety/**/*.test.js',
      'netlify/functions/_shared/study-adult-review/**/*.test.js',
      'src/study/safety/**/*.test.ts',
    ],
  },
}
