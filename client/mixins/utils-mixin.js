const weightUtils = require("../utils/weight.js");

var utilsMixin = {
    data: function() {
        return {
            
        }
    },
    methods: {
    },
    filters: {
        displayWeight: function (mg, unit) {
            return weightUtils.MgToWeight(mg, unit) || 0;
        },
        displayPrice: function(price, symbol) {
            let amount = "0.00";
            if (typeof price === "number") {
                amount = price.toFixed(2);
            }
            return symbol + amount;
        }
    }
};

module.exports = utilsMixin;