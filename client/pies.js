const colorUtils = require("./utils/color.js");

module.exports = function(args) {
    var container,
        context,
        srcData,
        data = {},
        bounds,
        center,
        radius,
        pieHole = .3,
        spacing = .1,
        hovered = null,
        hoverCallback = null,
        clickCallback = null,
        backgroundColor = "rgb(245,245,245)",
        firstRing = {inner: 25, outer: 70},
        secondRing = {inner: 80, outer: 120},
        tooltip,
        isAnimating = false,
        frameRate = 10;

    function init() {
        if (!args.container || (!args.data && !args.processedData)) {
            console.warn("invalid params!!");
            return;
        }
        container = args.container;
        container.style.position = "relative";
        context = container.getContext('2d');
        if (args.data) {
            srcData = args.data;
            data = preprocess(srcData)
        }
        else if (args.processedData) {
            data = args.processedData;
        }

        bounds = {x: context.canvas.width, y: context.canvas.height};
        center = {x: bounds.x/2, y: bounds.y/2};

        if (center.x < center.y) radius = center.x;
        else radius = center.y;

        if (args.clickCallback) clickCallback = args.clickCallback;
        if (args.hoverCallback) hoverCallback = args.hoverCallback;
        drawGraph();

        tooltip = document.createElement("div");
        tooltip.classList.add("tooltip");
        document.getElementsByTagName("body")[0].appendChild(tooltip);
    }

    function update(args) {
        var oldVisibleRings = getVisibleRings(data);

        if (args.data) {
            data = preprocess(args.data);
        } else if (args.processedData) {
            data = args.processedData;
        } else {
            return;
        }
        setVisibleRings(oldVisibleRings, data);

        context.clearRect ( 0 , 0 , bounds.x , bounds.y );
        drawGraph();
    }

    function preprocess(srcData, parent) {
        var data = {};
        var total = 0;
        data.points = {};

        for (var key in srcData) {
            var value = srcData[key];
            if (typeof(value) == "object") {
               total += preprocess(value).total;
            } else {
                total += value;
            }
        }
        data.total = total;

        for (var key in srcData) {
            var value = srcData[key];
            if (typeof(value) == "object") {
                data.points[key] = preprocess(value, data);
                data.points[key].name = key;
                data.points[key].visiblePoints = false;
            } else {
                data.points[key] = {
                    value: value,
                    percent: value/total,
                    name: key,
                    parent: data
                };
            }
        }
        
        if (parent) {
            data.percent = total/parent.total;
            data.parent = parent;
        }
        return data;
    }

    function render(myData) {
        var offset = 5,
            parentColor = false,
            angleMultiplier = 1,
            lastAngle = 0.0,
            minRadius = myData.innerMinRadius,
            maxRadius = myData.innerMaxRadius;

        if (myData.startAngle) lastAngle = myData.startAngle;
        var startAngle = lastAngle;
        if (myData.angleMultiplier) angleMultiplier = myData.angleMultiplier;
        
        if (myData.color) {
            parentColor = myData.color;
        }

        var count = 0;
        for (var key in myData.points) {
            var slice = myData.points[key];

            slice.startAngle = startAngle;

            slice.minRadius = minRadius;
            slice.maxRadius = maxRadius;
            slice.myAngle = slice.percent*Math.PI*2*angleMultiplier;
            slice.minAngle = lastAngle;
            slice.maxAngle = lastAngle + slice.myAngle;
            slice.avgAngle = (slice.minAngle + slice.maxAngle)/2
            slice.outsideMinPoint = {
                x: center.x + Math.cos(slice.minAngle)*maxRadius,
                y: center.y + Math.sin(slice.minAngle)*maxRadius
            }
            slice.outsideMaxPoint = {
                x: center.x + Math.cos(slice.maxAngle)*maxRadius,
                y: center.y + Math.sin(slice.maxAngle)*maxRadius
            };
            slice.insideMinPoint = {
                x: center.x + Math.cos(slice.minAngle)*slice.minRadius,
                y: center.y + Math.sin(slice.minAngle)*slice.minRadius
            }
            slice.insideMaxPoint = {
                x: center.x + Math.cos(slice.maxAngle)*slice.minRadius,
                y: center.y + Math.sin(slice.maxAngle)*slice.minRadius
            }

            if (!slice.color) {
                slice.color = colorUtils.getColor(count, parentColor);
            }

            slice.startAngle = lastAngle

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
        
        context.fillStyle = colorUtils.rgbToString(slice.color);

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
        var rings = getVisibleRings(data);
        var duration = 600;
        var d = new Date();
        for (var i = 0; i < rings.length; i++) {
            var ring = rings[i];
            var minMax = getMinMax(i+1, rings.length);
            if (ring.innerMinRadius) {
                ring.startMinRadius = ring.innerMinRadius;
                ring.startMaxRadius = ring.innerMaxRadius;    
            } else {
                ring.startMinRadius = minMax[1];
                ring.startMaxRadius = minMax[1];
            }
            
            ring.startAngleMultiplier = 1;
            if (i == rings.length -1 && rings.length > 1) {
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
        var rings = getVisibleRings(data);
        var d = new Date();
        if (d.getTime() - frameRate > rings[0].finishTime) return;

        context.clearRect(0 , 0 , bounds.x , bounds.y);
        
        for (var i in rings) {
            var ring = rings[i];
            
            var percentAnimated = (d.getTime() - ring.startTime) / ring.deltaTime;
            if (percentAnimated > 1) percentAnimated = 1;
            ring.innerMinRadius = ring.startMinRadius + (ring.deltaMinRadius * ring.radiusFunction(percentAnimated));
            ring.innerMaxRadius = ring.startMaxRadius + (ring.deltaMaxRadius * ring.radiusFunction(percentAnimated));
            ring.angleMultiplier = ring.startAngleMultiplier + (ring.deltaAngleMultiplier * ring.angleMultiplierFunction(percentAnimated));
            render(ring);
        }
        setTimeout(animateStep, frameRate);
    }

    function attachEvents() {
        container.addEventListener("mousemove", hoverHandle);
        container.addEventListener("click", clickHandle);
    }

    function hoverHandle(evt) {
        var containerRect = container.getBoundingClientRect();
        var size = {x: containerRect.width, y: containerRect.height};
        var offset = {x: (evt.pageX - containerRect.left) * (bounds.x / size.x), y: (evt.pageY - containerRect.top) * (bounds.y / size.y)};
        var dX = (offset.x - center.x);
        var dY = (offset.y - center.y);
        var angle = Math.atan( dY / dX );
        if (dX < 0) angle += Math.PI;
        else if (dY < 0) angle += Math.PI*2
        var radius = Math.sqrt(dX*dX + dY*dY);

        var newHovered = findHovered(data, angle, radius);

        if (newHovered ) {
            if (newHovered != hovered) {
                if (hovered) drawSlice(hovered);
                hovered = newHovered
                drawSlice(hovered, "rgb(50,50,50)");
                container.classList.add("activeHover");
                if (hoverCallback) hoverCallback(newHovered);
            }
            tooltip.style.display = "block";
            tooltip.innerText = newHovered.name;
            tooltip.style.top = evt.pageY - 10 + "px";
            tooltip.style.left = evt.pageX + 15 + "px";
        } else {
            if (hovered) {
                drawSlice(hovered);
                if (hoverCallback) hoverCallback(newHovered);
            }
            hovered = 0;
            container.classList.remove("activeHover");
            tooltip.style.display = "none";
        }

    }

    function clickHandle(evt) {
        if (!hovered) {
            recursivelySetAttribute(data, "visiblePoints", false);
            data.visiblePoints = true;
            context.clearRect ( 0 , 0 , bounds.x , bounds.y );
            animateAdd()
            return;
        }
        if (!hovered.points) return;

        recursivelySetAttribute(hovered.parent, "visiblePoints", false);
        hovered.parent.visiblePoints = true;
        hovered.visiblePoints = true;
        
        animateAdd();
        if (clickCallback) clickCallback(hovered);
    }

    function open(key) {
        if (key) {
            hovered = data.points[key];
        }
        if (!hovered) {
            return;
        }
        recursivelySetAttribute(hovered.parent, "visiblePoints", false);
        hovered.parent.visiblePoints = true;
        hovered.visiblePoints = true;
        animateAdd();
    }

    function close() {
        recursivelySetAttribute(data, "visiblePoints", false);
        data.visiblePoints = true;
        context.clearRect ( 0 , 0 , bounds.x , bounds.y );
        animateAdd()
    }

    function findHovered(data, angle, radius) {
        for (var key in data.points) {
            var i = data.points[key];
            if (i.points && i.visiblePoints) {
                var found = findHovered(i, angle, radius);
                if (found) return found;
            }
            var startAngle = 0;
            if (typeof i.parent.startAngle != "undefined") startAngle = i.parent.startAngle;

            if (radius < i.maxRadius && radius > i.minRadius) {
                if (i.minAngle <= Math.PI*2 && i.maxAngle > Math.PI*2 && ( angle > i.minAngle || angle+Math.PI*2 < i.maxAngle)) {
                    return i;
                } else if (i.minAngle >= Math.PI*2 && i.maxAngle > Math.PI*2 && angle+Math.PI*2 > i.minAngle && angle+Math.PI*2 < i.maxAngle) {
                    return i
                } else if (angle > i.minAngle && angle < i.maxAngle) {
                    return i;
                } 
            }
        }
        return null;
    }

    function findSectionById(id) {
        for (var i in data.points) {
            if (data.points[i].id && data.points[i].id == id) return data.points[i];
        }
        return false;
    }

    function recursivelySetAttribute(data, key, value) {
        data[key] = value;
        for (var i in data.points) {
            recursivelySetAttribute(data.points[i], key, value);
        }
    }

    function drawGraph() {
        data.visiblePoints = true;
        var rings = getVisibleRings(data);

        for (var i = 0; i < rings.length; i++) {
            var ring = rings[i];
            var minMax = getMinMax(i+1, rings.length);
            ring.innerMinRadius = minMax[0];
            ring.innerMaxRadius = minMax[1];
            render(ring);
        }

        attachEvents();
    }

    function getVisibleRings(data) {
        var out = [data];
        for (var i in data.points) {
            if (data.points[i].visiblePoints) {
                if (data.points[i].points) out = out.concat(getVisibleRings(data.points[i]));
                break;
            }
        }
        return out;
    }

    function setVisibleRings(rings, data) {
        //pass in old visible rings to translate to new data
        if (typeof data.id != "undefined") {
            for (var i in rings) {
                if (data.id == rings[i].id) {
                    data.visiblePoints = true;
                }
            }
        }
        for (var i in data.points) {
            setVisibleRings(rings, data.points[i]);
        }
    }

    function getMinMax(level, levels) {
        var minRadius = pieHole*(1/levels) + (((level-1)/levels) * (1-pieHole));
        var maxRadius = pieHole*(1/levels) + ((level/levels - spacing) * (1-pieHole));
        if (levels == 1) {
            maxRadius *= 0.8
        }
        return [minRadius*radius, maxRadius*radius];
    }

    function easeThenDelay(x) {
        if (x > 0.5) return 1;
        var out = (1-Math.cos(x*2*Math.PI))/2;
        if (out > 1) out = 1;
        return out;
    }

    function delayThenEase(x) {
        if (x < 0.5) return 0;
        var out = (1-Math.cos((x-0.5)*2*Math.PI))/2;
        if (out > 1) out = 1;
        return out;
    }

    init();
    return {update: update, open: open, close: close};
}