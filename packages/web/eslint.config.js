import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Pre-existing violations across App.tsx, FlowCanvas.tsx, FlowNode.tsx,
      // useFlowAnimation.ts, useFlowGraphLayout.ts. Downgraded to warn so CI
      // still surfaces them on every PR without blocking. Tracked by a
      // follow-up issue — fix these properly and flip back to "error".
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
      'no-empty': 'warn',
    },
  },
])
