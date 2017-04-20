const Vue = require("vue");

Vue.directive("select-on-focus", {
    inserted: function (el) {
        el.addEventListener("focus", (evt) => {
            el.select();
        });
    }
});

Vue.directive("focus-on-create", {
    inserted: function (el, bus) {
        el.focus();
    }
});

Vue.directive("focus-on-bus", {
    inserted: function (el, args) {
        bus.$on(args.value, () => {
            el.focus();
        });
    }
});

Vue.directive("select-on-bus", {
    inserted: function (el, args) {
        bus.$on(args.value, () => {
            el.select();
        });
    }
});