import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
    { ignores: ['node_modules/', 'public/', 'scripts/', 'server/sha3.js'] },
    js.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        languageOptions: {
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
                ...globals.node,
                chartData: 'readonly',
            },
        },
        rules: {
            'consistent-return': 'off',
            'func-names': 'off',
            'indent': ['error', 4],
            'max-len': 'off',
            'no-shadow': 'off',
            'no-param-reassign': 'off',
            'no-plusplus': 'off',
            'no-unused-vars': ['error', { varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
            'prefer-destructuring': 'off',
            'vue/html-indent': ['error', 4],
            'vue/max-attributes-per-line': 'off',
            'vue/multi-word-component-names': 'off',
            'vue/require-default-prop': 'off',
            'vue/require-prop-types': 'off',
            'vue/no-template-shadow': 'off',
        },
    },
];
