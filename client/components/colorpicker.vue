<style lang="scss">

#lpPickerContainer {
    background: #fff;
    border: 1px solid #999;
    display: none;
    position: absolute;
    z-index: 105;

    &.lpOpen {
        display: block;
    }

    canvas {
        display: block;
    }
}

</style>

<template>
    <modal :shown="shown" @hide="shown = false" id="lpPickerContainer">
        <canvas id="colorPicker" width="256" height="256"></canvas>
    </modal>
</template>

<script>
import modal from "./modal.vue";

export default {
    name: "unit-select",
    components: {
        modal
    },
    data: function() {
        return {
            callback: false,
            image: "data:image/jpeg;base64,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",
            shown: false
        };
    },
    methods: {
        toggle: function() {
            this.isOpen = !this.isOpen;
            this.init();
        },
        select: function(unit) {
            if (typeof this.onChange === "function") {
                this.onChange(unit);
            }
        },

        positionPicker: function(evt) {
            var targetRect = evt.target.getBoundingClientRect();
            var container = document.getElementById("lpPickerContainer")
            container.style.left = (targetRect.left + 15) + "px";
            container.style.top = targetRect.top + "px";
        },
        init: function() {
            var imageObj = new Image();
            var self = this;
            imageObj.src = this.image;
            imageObj.onload = function() {
                self.bindHandlers(this);
            }
        },
        bindHandlers: function(imageObj) {
            var canvas = document.getElementById('colorPicker');
            var context = canvas.getContext('2d');
            context.drawImage(imageObj, 0, 0);
            var rect = canvas.getBoundingClientRect();
            var imageData = context.getImageData(0, 0, imageObj.width, imageObj.width);
            var data = imageData.data;

            var mouseDown = false;

            canvas.addEventListener('mousedown', function() {
                mouseDown = true;
            }, false);

            canvas.addEventListener('mouseup', function() {
                mouseDown = false;
            }, false);

            canvas.addEventListener('mousemove', (evt) => {
                var x = Math.round(evt.clientX - rect.left);
                var y = Math.round(evt.clientY - rect.top);

                if (mouseDown && x > 0 && x < 0 + imageObj.width && y > 0 && y < 0 + imageObj.height) {
                    var r = data[((imageObj.width * y) + x) * 4];
                    var g = data[((imageObj.width * y) + x) * 4 + 1];
                    var b = data[((imageObj.width * y) + x) * 4 + 2];
                    this.callback({r,g,b});
                }
            }, false);

        }
    },
    beforeMount: function() {
        bus.$on("showColorPicker", (args) => {
            this.shown = true;
            this.positionPicker(args.evt);
            this.callback = args.callback;
            this.init();
        });
    }
}



</script>

