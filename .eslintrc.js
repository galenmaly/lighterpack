module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "node": true,
    },
    "extends": [
        "airbnb-base",
        "plugin:vue/recommended",
    ],
    "parserOptions": {
        "ecmaVersion": 2017,
    },
    "globals": {
        "bus": true, // TODO: reduce reliance on bus and remove this from window.
    },
    "rules": {
        "func-names": "off", // TODO
        "gard-for-in": "off", // TODO
        "indent": [ "error", 4 ],  // Stylistic preference
        "max-len": "off", // TODO
        "no-shadow": "off", // TODO
        "no-param-reassign": "off", // TODO
        "no-plusplus": "off", // TODO
        "prefer-destructuring": "off", // TODO
        "vue/html-indent": ["error", 4], // Stylistic preference
        "vue/max-attributes-per-line": "off", // Investigate
    }
};