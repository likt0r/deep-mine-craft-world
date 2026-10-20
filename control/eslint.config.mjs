import prettierConfig from "eslint-config-prettier";
import pluginRecommended from "eslint-plugin-prettier/recommended";

import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(pluginRecommended, prettierConfig, {
  rules: {
    "vue/v-on-event-hyphenation": ["error", "never"],
    "vue/attribute-hyphenation": ["error", "never"],
    "vue/multi-word-component-names": "off",
    "vue/require-default-prop": "off"
  },
  ignores: ["node_modules", ".output", "test-results", "playwright-report"]
});
