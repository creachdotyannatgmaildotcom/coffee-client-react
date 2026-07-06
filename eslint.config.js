import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// ESLint est volontairement réduit à une seule responsabilité : les règles
// des hooks React et les diagnostics du React Compiler
// (eslint-plugin-react-hooks). Format, tri des imports et lint généraliste
// restent portés par Biome — aucune règle de style ici.
export default tseslint.config({
  ignores: ['src/routeTree.gen.ts'],
  files: ['src/**/*.{ts,tsx}'],
  extends: [reactHooks.configs.flat['recommended-latest']],
  languageOptions: {
    parser: tseslint.parser,
  },
})
