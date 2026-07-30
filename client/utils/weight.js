export default (function () {
    function WeightToMg(value, unit) {
        if (unit == 'g') {
            return value * 1000;
        } if (unit == 'kg') {
            return value * 1000000;
        } if (unit == 'oz') {
            return value * 28349.5;
        } if (unit == 'lb') {
            return value * 453592;
        }
    }

    function MgToWeight(value, unit) {
        if (unit == 'g') {
            return Math.round(100 * value / 1000.0) / 100;
        } if (unit == 'kg') {
            return Math.round(100 * value / 1000000.0, 2) / 100;
        } if (unit == 'oz') {
            return Math.round(100 * value / 28349.5, 2) / 100;
        } if (unit == 'lb') {
            return Math.round(100 * value / 453592.0, 2) / 100;
        }
    }

    // Round grams fully, don't round anything else further.
    function MgToDisplayWeight(value, unit) {
        const weight = MgToWeight(value, unit);

        if (unit != 'g') {
            return weight;
        } 
        
        return Math.round(weight);
    }

    return {
        WeightToMg,
        MgToWeight,
        MgToDisplayWeight,
    };
}());
