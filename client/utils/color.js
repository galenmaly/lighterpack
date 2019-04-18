module.exports = (function() {
    function getColor(index, baseColor) {
        if (baseColor) {
            var hsv = rgbToHsv(baseColor);
            hsv.s -= Math.round(((hsv.s)/10)*(index%10));
            hsv.v += Math.round(((100-hsv.v)/10)*(index%10));
            return hsvToRgb(hsv);
        } else {
            //colors = [{r:57, g:142, b:221}, {r:251, g:51, b:74}, {r:248, g:202, b:0}, {r:174, g:226, b:57}, {r:184, g:51, b:222}, {r:255, g:142, b:50}, {r:220, g:242, b:51}, {r:86, g:174, b:226}, {r:226, g:86, b:174}, {r:226, g:137, b:86}, {r:86, g:226, b:207}];
            var colors = [{r:27, g:119, b:211}, {r:206, g:24, b:54}, {r:242, g:208, b:0}, {r:122, g:179, b:23}, {r:130, g:33, b:198}, {r:232, g:110, b:28}, {r:220, g:242, b:51}, {r:86, g:174, b:226}, {r:226, g:86, b:174}, {r:226, g:137, b:86}, {r:86, g:226, b:207}];
            return colors[index%colors.length];    
        }
    }

    function hsvToRgb(hsv) {
        var r, g, b, i, f, p, q, t;
        var h = hsv.h/360;
        var s = hsv.s/100;
        var v = hsv.v/100

        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return {
            r: Math.floor(r * 255),
            g: Math.floor(g * 255),
            b: Math.floor(b * 255)
        };
    }

    function rgbToHsv(rgb) {
        var rr, gg, bb,
            r = rgb.r / 255,
            g = rgb.g / 255,
            b = rgb.b / 255,
            h, s,
            v = Math.max(r, g, b),
            diff = v - Math.min(r, g, b),
            diffc = function(c){
                return (v - c) / 6 / diff + 1 / 2;
            };

        if (diff == 0) {
            h = s = 0;
        } else {
            s = diff / v;
            rr = diffc(r);
            gg = diffc(g);
            bb = diffc(b);

            if (r === v) {
                h = bb - gg;
            }else if (g === v) {
                h = (1 / 3) + rr - bb;
            }else if (b === v) {
                h = (2 / 3) + gg - rr;
            }
            if (h < 0) {
                h += 1;
            }else if (h > 1) {
                h -= 1;
            }
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            v: Math.round(v * 100)
        };
    }

    function rgbToString(rgb) {
        return "rgb(" + rgb.r + "," + rgb.g + "," +rgb.b + ")";
    }

    function stringToRgb(rgbString) {
         rgbString = rgbString.substring(4,rgbString.length-1);
         var split = rgbString.split(",");
         return {
            r: parseInt(split[0]),
            g: parseInt(split[1]),
            b: parseInt(split[2])
         };
    }

    function hexToRgb(hex) {
         var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function rgbToHex(rgb) {
        return "#" + componentToHex(rgb.r) + componentToHex(rgb.g) + componentToHex(rgb.b);
    }

    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
    return {
        getColor,
        hsvToRgb,
        rgbToHsv,
        rgbToString,
        stringToRgb,
        hexToRgb,
        rgbToHex
    }
})();
