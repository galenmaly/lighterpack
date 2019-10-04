module.exports = (function () {
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

    function MgToWeight(value, unit, display) {
        if (typeof display === 'undefined') display = false;
        if (unit == 'g') {
            return Math.round(100 * value / 1000.0) / 100;
        } if (unit == 'kg') {
            return Math.round(100 * value / 1000000.0, 2) / 100;
        } if (unit == 'oz') {
            return Math.round(100 * value / 28349.5, 2) / 100;
        } if (unit == 'lb') {
            if (display) {
                let out = '';
                const poundsFloat = value / 453592.0;
                const pounds = Math.floor(poundsFloat);
                const oz = Math.round((poundsFloat % 1) * 16 * 100) / 100;
                if (pounds) {
                    out += 'lb';
                    if (pounds > 1) out += 's';
                }
            } else {
                return Math.round(100 * value / 453592.0, 2) / 100;
            }
        }
    }

    return {
        WeightToMg,
        MgToWeight,
    };
}());
