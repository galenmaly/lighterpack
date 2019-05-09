pies = function (args) {
    let container;
    let canvas;
    let context;
    let srcData;
    let data = {};
    let bounds;
    let center;
    let radius;
    const pieHole = 0.3;
    const spacing = 0.1;
    let hovered = null;
    let hoverCallback = null;
    let clickCallback = null;
    const backgroundColor = 'rgb(245,245,245)';
    const firstRing = { inner: 25, outer: 70 };
    const secondRing = { inner: 80, outer: 120 };
    let $tooltip;
    const isAnimating = false;
    const frameRate = 10;

    function init() {
        if (!args.container.length || (!args.data && !args.processedData)) {
            console.warn('invalid params!!');
            return;
        }
        container = args.container;
        container.css('position', 'relative');
        canvas = container[0];
        context = canvas.getContext('2d');
        if (args.data) {
            srcData = args.data;
            data = preprocess(srcData);
        } else if (args.processedData) {
            data = args.processedData;
        }

        bounds = { x: context.canvas.width, y: context.canvas.height };
        center = { x: bounds.x / 2, y: bounds.y / 2 };

        if (center.x < center.y) radius = center.x;
        else radius = center.y;

        if (args.clickCallback) clickCallback = args.clickCallback;
        if (args.hoverCallback) hoverCallback = args.hoverCallback;
        drawGraph();
        $tooltip = $("<div class='tooltip' style='position:absolute;display:none;border:1px solid #FFF;background:#444;color:#FFF;box-shadow:0 0 5px rgba(0,0,0,0.25);padding:3px;z-index:105;'></tooltip>");
        $('body').append($tooltip);
    }

    function update(args) {
        const oldVisibleRings = getVisibleRings(data);

        if (args.data) {
            data = preprocess(args.data);
        } else if (args.processedData) {
            data = args.processedData;
        } else {
            return;
        }
        setVisibleRings(oldVisibleRings, data);

        context.clearRect(0, 0, bounds.x, bounds.y);
        drawGraph();
    }

    function preprocess(srcData, parent) {
        const data = {};
        let total = 0;
        data.points = {};

        for (var key in srcData) {
            var value = srcData[key];
            if (typeof (value) === 'object') {
                total += preprocess(value).total;
            } else {
                total += value;
            }
        }
        data.total = total;

        for (var key in srcData) {
            var value = srcData[key];
            if (typeof (value) === 'object') {
                data.points[key] = preprocess(value, data);
                data.points[key].name = key;
                data.points[key].visiblePoints = false;
            } else {
                data.points[key] = {
                    value,
                    percent: value / total,
                    name: key,
                    parent: data,
                };
            }
        }

        if (parent) {
            data.percent = total / parent.total;
            data.parent = parent;
        }
        return data;
    }

    function render(myData) {
        const offset = 5;
        let parentColor = false;
        let angleMultiplier = 1;
        let lastAngle = 0.0;
        const minRadius = myData.innerMinRadius;
        const maxRadius = myData.innerMaxRadius;

        if (myData.startAngle) lastAngle = myData.startAngle;
        const startAngle = lastAngle;
        if (myData.angleMultiplier) angleMultiplier = myData.angleMultiplier;

        if (myData.color) {
            parentColor = myData.color;
        }

        let count = 0;
        for (const key in myData.points) {
            const slice = myData.points[key];

            slice.startAngle = startAngle;

            slice.minRadius = minRadius;
            slice.maxRadius = maxRadius;
            slice.myAngle = slice.percent * Math.PI * 2 * angleMultiplier;
            slice.minAngle = lastAngle;
            slice.maxAngle = lastAngle + slice.myAngle;
            slice.avgAngle = (slice.minAngle + slice.maxAngle) / 2;
            slice.outsideMinPoint = {
                x: center.x + Math.cos(slice.minAngle) * maxRadius,
                y: center.y + Math.sin(slice.minAngle) * maxRadius,
            };
            slice.outsideMaxPoint = {
                x: center.x + Math.cos(slice.maxAngle) * maxRadius,
                y: center.y + Math.sin(slice.maxAngle) * maxRadius,
            };
            slice.insideMinPoint = {
                x: center.x + Math.cos(slice.minAngle) * slice.minRadius,
                y: center.y + Math.sin(slice.minAngle) * slice.minRadius,
            };
            slice.insideMaxPoint = {
                x: center.x + Math.cos(slice.maxAngle) * slice.minRadius,
                y: center.y + Math.sin(slice.maxAngle) * slice.minRadius,
            };

            if (!slice.color) {
                slice.color = getColor(count, parentColor);
            }

            slice.startAngle = lastAngle;

            drawSlice(slice);

            lastAngle = slice.maxAngle;
            count++;
        }
    }

    function drawSlice(slice, color) {
        if (color) {
            context.strokeStyle = color;
            context.lineWidth = 2;
        } else {
            context.strokeStyle = backgroundColor;
            context.lineWidth = 3;
        }

        context.fillStyle = rgbToString(slice.color);

        context.beginPath();
        context.moveTo(slice.outsideMinPoint.x, slice.outsideMinPoint.y);
        context.arc(center.x, center.y, slice.maxRadius, slice.minAngle, slice.maxAngle);
        context.lineTo(slice.insideMaxPoint.x, slice.insideMaxPoint.y);
        context.arc(center.x, center.y, slice.minRadius, slice.maxAngle, slice.minAngle, true);
        context.lineTo(slice.outsideMinPoint.x, slice.outsideMinPoint.y);
        context.stroke();
        context.fill();
        context.closePath();
    }

    function animateAdd() {
        const rings = getVisibleRings(data);
        const duration = 600;
        const d = new Date();
        for (let i = 0; i < rings.length; i++) {
            const ring = rings[i];
            const minMax = getMinMax(i + 1, rings.length);
            if (ring.innerMinRadius) {
                ring.startMinRadius = ring.innerMinRadius;
                ring.startMaxRadius = ring.innerMaxRadius;
            } else {
                ring.startMinRadius = minMax[1];
                ring.startMaxRadius = minMax[1];
            }

            ring.startAngleMultiplier = 1;
            if (i == rings.length - 1 && rings.length > 1) {
                ring.startAngleMultiplier = ring.percent;
                ring.startMinRadius = minMax[1];
            }

            ring.targetMinRadius = minMax[0];
            ring.targetMaxRadius = minMax[1];
            ring.targetAngleMultiplier = 1;

            ring.deltaMinRadius = ring.targetMinRadius - ring.startMinRadius;
            ring.deltaMaxRadius = ring.targetMaxRadius - ring.startMaxRadius;
            ring.deltaAngleMultiplier = ring.targetAngleMultiplier - ring.startAngleMultiplier;

            ring.startTime = d.getTime();
            ring.finishTime = ring.startTime + duration;
            ring.deltaTime = duration;

            ring.angleMultiplierFunction = delayThenEase;
            ring.radiusFunction = easeThenDelay;
        }

        setTimeout(animateStep, frameRate);
    }

    function animateStep() {
        const rings = getVisibleRings(data);
        const d = new Date();
        if (d.getTime() - frameRate > rings[0].finishTime) return;

        context.clearRect(0, 0, bounds.x, bounds.y);

        for (const i in rings) {
            const ring = rings[i];

            let percentAnimated = (d.getTime() - ring.startTime) / ring.deltaTime;
            if (percentAnimated > 1) percentAnimated = 1;
            ring.innerMinRadius = ring.startMinRadius + (ring.deltaMinRadius * ring.radiusFunction(percentAnimated));
            ring.innerMaxRadius = ring.startMaxRadius + (ring.deltaMaxRadius * ring.radiusFunction(percentAnimated));
            ring.angleMultiplier = ring.startAngleMultiplier + (ring.deltaAngleMultiplier * ring.angleMultiplierFunction(percentAnimated));
            render(ring);
        }
        setTimeout(animateStep, frameRate);
    }

    function attachEvents() {
        container.off('mousemove').on('mousemove', hoverHandle);
        container.off('click').on('click', clickHandle);
    }

    function hoverHandle(evt) {
        const containerOffset = container.offset();
        const size = { x: container.width(), y: container.height() };
        const offset = { x: (evt.pageX - containerOffset.left) * (bounds.x / size.x), y: (evt.pageY - containerOffset.top) * (bounds.y / size.y) };
        const dX = (offset.x - center.x);
        const dY = (offset.y - center.y);
        let angle = Math.atan(dY / dX);
        if (dX < 0) angle += Math.PI;
        else if (dY < 0) angle += Math.PI * 2;
        const radius = Math.sqrt(dX * dX + dY * dY);

        newHovered = findHovered(data, angle, radius);

        if (newHovered) {
            if (newHovered != hovered) {
                if (hovered) drawSlice(hovered);
                hovered = newHovered;
                drawSlice(hovered, 'rgb(50,50,50)');
                container.addClass('activeHover');
                if (hoverCallback) hoverCallback(newHovered);
            }
            $tooltip.show().text(newHovered.name);
            $tooltip.css({ top: evt.pageY - 10, left: evt.pageX + 15 });
        } else {
            if (hovered) {
                drawSlice(hovered);
                if (hoverCallback) hoverCallback(newHovered);
            }
            hovered = 0;
            container.removeClass('activeHover');
            $tooltip.hide();
        }
    }

    function clickHandle(evt) {
        if (!hovered) {
            recursivelySetAttribute(data, 'visiblePoints', false);
            data.visiblePoints = true;
            context.clearRect(0, 0, bounds.x, bounds.y);
            animateAdd();
            return;
        }
        if (!hovered.points) return;

        recursivelySetAttribute(hovered.parent, 'visiblePoints', false);
        hovered.parent.visiblePoints = true;
        hovered.visiblePoints = true;

        animateAdd();
        if (clickCallback) clickCallback(hovered);
    }

    function open() {
        if (!hovered) {
            return;
        }
        recursivelySetAttribute(hovered.parent, 'visiblePoints', false);
        hovered.parent.visiblePoints = true;
        hovered.visiblePoints = true;
        animateAdd();
    }

    function close() {
        recursivelySetAttribute(data, 'visiblePoints', false);
        data.visiblePoints = true;
        context.clearRect(0, 0, bounds.x, bounds.y);
        animateAdd();
    }

    function findHovered(data, angle, radius) {
        for (const key in data.points) {
            const i = data.points[key];
            if (i.points && i.visiblePoints) {
                const found = findHovered(i, angle, radius);
                if (found) return found;
            }
            let startAngle = 0;
            if (typeof i.parent.startAngle !== 'undefined') startAngle = i.parent.startAngle;

            if (radius < i.maxRadius && radius > i.minRadius) {
                if (i.minAngle <= Math.PI * 2 && i.maxAngle > Math.PI * 2 && (angle > i.minAngle || angle + Math.PI * 2 < i.maxAngle)) {
                    return i;
                } if (i.minAngle >= Math.PI * 2 && i.maxAngle > Math.PI * 2 && angle + Math.PI * 2 > i.minAngle && angle + Math.PI * 2 < i.maxAngle) {
                    return i;
                } if (angle > i.minAngle && angle < i.maxAngle) {
                    return i;
                }
            }
        }
        return null;
    }

    function findSectionById(id) {
        for (const i in data.points) {
            if (data.points[i].id && data.points[i].id == id) return data.points[i];
        }
        return false;
    }

    function recursivelySetAttribute(data, key, value) {
        data[key] = value;
        for (const i in data.points) {
            recursivelySetAttribute(data.points[i], key, value);
        }
    }

    function drawGraph() {
        data.visiblePoints = true;
        const rings = getVisibleRings(data);

        for (let i = 0; i < rings.length; i++) {
            const ring = rings[i];
            const minMax = getMinMax(i + 1, rings.length);
            ring.innerMinRadius = minMax[0];
            ring.innerMaxRadius = minMax[1];
            render(ring);
        }

        attachEvents();
    }

    function getVisibleRings(data) {
        out = [data];
        for (const i in data.points) {
            if (data.points[i].visiblePoints) {
                if (data.points[i].points) out = out.concat(getVisibleRings(data.points[i]));
                break;
            }
        }
        return out;
    }

    function setVisibleRings(rings, data) {
        // pass in old visible rings to translate to new data
        if (typeof data.id !== 'undefined') {
            for (var i in rings) {
                if (data.id == rings[i].id) {
                    data.visiblePoints = true;
                }
            }
        }
        for (var i in data.points) {
            setVisibleRings(rings, data.points[i]);
        }
        return out;
    }

    function getMinMax(level, levels) {
        const minRadius = pieHole * (1 / levels) + (((level - 1) / levels) * (1 - pieHole));
        let maxRadius = pieHole * (1 / levels) + ((level / levels - spacing) * (1 - pieHole));
        if (levels == 1) {
            maxRadius *= 0.8;
        }
        return [minRadius * radius, maxRadius * radius];
    }

    function easeThenDelay(x) {
        if (x > 0.5) return 1;
        out = (1 - Math.cos(x * 2 * Math.PI)) / 2;
        if (out > 1) out = 1;
        return out;
    }

    function delayThenEase(x) {
        if (x < 0.5) return 0;
        out = (1 - Math.cos((x - 0.5) * 2 * Math.PI)) / 2;
        if (out > 1) out = 1;
        return out;
    }

    init();
    return { update, open, close };
};

function HSVtoRGB(hsv) {
    let r; let g; let b; let i; let f; let p; let q; let
        t;
    const h = hsv.h / 360;
    const s = hsv.s / 100;
    const v = hsv.v / 100;

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
        b: Math.floor(b * 255),
    };
}

function rgb2hsv(rgb) {
    let rr; let gg; let bb;
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    let h; let s;
    const v = Math.max(r, g, b);
    const diff = v - Math.min(r, g, b);
    const diffc = function (c) {
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
        } else if (g === v) {
            h = (1 / 3) + rr - bb;
        } else if (b === v) {
            h = (2 / 3) + gg - rr;
        }
        if (h < 0) {
            h += 1;
        } else if (h > 1) {
            h -= 1;
        }
    }
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        v: Math.round(v * 100),
    };
}

function getColor(index, baseColor) {
    if (baseColor) {
        const hsv = rgb2hsv(baseColor);
        hsv.s -= Math.round(((hsv.s) / 10) * (index % 10));
        hsv.v += Math.round(((100 - hsv.v) / 10) * (index % 10));
        return HSVtoRGB(hsv);
    }
    // colors = [{r:57, g:142, b:221}, {r:251, g:51, b:74}, {r:248, g:202, b:0}, {r:174, g:226, b:57}, {r:184, g:51, b:222}, {r:255, g:142, b:50}, {r:220, g:242, b:51}, {r:86, g:174, b:226}, {r:226, g:86, b:174}, {r:226, g:137, b:86}, {r:86, g:226, b:207}];
    colors = [{ r: 27, g: 119, b: 211 }, { r: 206, g: 24, b: 54 }, { r: 242, g: 208, b: 0 }, { r: 122, g: 179, b: 23 }, { r: 130, g: 33, b: 198 }, { r: 232, g: 110, b: 28 }, { r: 220, g: 242, b: 51 }, { r: 86, g: 174, b: 226 }, { r: 226, g: 86, b: 174 }, { r: 226, g: 137, b: 86 }, { r: 86, g: 226, b: 207 }];
    return colors[index % colors.length];
}

function rgbToString(rgb) {
    return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
}

function rgbStringToRgb(rgbString) {
    rgbString = rgbString.substring(4, rgbString.length - 1);
    const split = rgbString.split(',');
    return {
        r: parseInt(split[0]),
        g: parseInt(split[1]),
        b: parseInt(split[2]),
    };
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    } : null;
}

function componentToHex(c) {
    const hex = c.toString(16);
    return hex.length == 1 ? `0${hex}` : hex;
}

function rgbToHex(rgb) {
    return `#${componentToHex(rgb.r)}${componentToHex(rgb.g)}${componentToHex(rgb.b)}`;
}
