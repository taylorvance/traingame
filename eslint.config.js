import defineReactAppConfig from '@taylorvance/tv-shared-dev/eslint/react-app'

export default [
  ...defineReactAppConfig(),
  {
    files: ['scripts/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
]
