import weightUtils from '../utils/weight.js';

const utilsMixin = {
    methods: {
        displayWeight(mg, unit) {
            return weightUtils.MgToDisplayWeight(mg, unit) || 0;
        },
        displayPrice(price, symbol) {
            let amount = '0.00';
            if (typeof price === 'number') {
                amount = price.toFixed(2);
            }
            return symbol + amount;
        },
        // Qty accepts fractions, so summing leaves float noise (0.1 + 0.2 ->
        // 0.30000000000000004). No toFixed: a subtotal of 5 reads 5, not 5.00.
        displayQty(qty) {
            return Math.round(qty * 100) / 100;
        },
    },
};

export default utilsMixin;
