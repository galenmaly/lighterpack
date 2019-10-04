module.exports = {
    "extends": "stylelint-config-standard",
    "plugins": [
        "stylelint-order"
    ],
    "rules": {
        "at-rule-no-unknown": [true, {
            "ignoreAtRules": ["function", "for", "each", "include", "mixin"] // for SASS directives
        }],
        "indentation": 4, // stylistic preference
        "no-descending-specificity": null, // stylistic preference
        "no-empty-source": null, // for vue file support
        "order/properties-alphabetical-order": true, // stylistic preference
    }
};