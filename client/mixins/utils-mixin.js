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
        }
    }
};

module.exports = utilsMixin;