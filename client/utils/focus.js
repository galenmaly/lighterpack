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

Vue.directive("empty-if-zero", {
    inserted: function (el, args) {
        el.addEventListener("focus", (evt) => {
            if (el.value === "0") {
                el.value = "";
            }
        });

        el.addEventListener("blur", (evt) => {
            if (el.value === "") {
                el.value = "0";
            }
        });
    }
});
