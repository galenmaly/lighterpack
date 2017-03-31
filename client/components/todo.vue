<style lang="scss">

</style>

<template>
    <div v-if="shown">
        <div class="lpDialog" id="TODO">
            <div class="lpContent">
                <p><a class="lpHref" href="mailto:info@lighterpack.com">Found a bug not here? Email me!</a></p>
                <h2>Known Bugs</h2>
                <ul>
                    <li>Sometimes a section of the pie chart gets "stuck" as hovered (workaround: mouse over empty area near pie chart)</li>
                    <li>Sometimes the gear section on the left freaks out and you can't drag from it or scroll in it. (don't know how to reproduce)</li>
                </ul>

                <h2>TODO Features</h2>
                <ul>
                    <li class="medium">Add utility to convert all items to a certain unit.</li>
                    <li class="medium">Guided "tour" for new users</li>
                    <li class="medium">Support for mobile devices</li>
                    <li class="medium">Make qty/weight validation nicer</li>
                    <li class="low">Collapse categories</li>
                    <li class="low">Add progress bar / spinner for file uploads</li>
                    <li class="low">Gear sorting?</li>
                    <li class="low">Better accomodate long names.</li>
                </ul>
            </div>
        </div>
        <div v-on:click="closeModal" class="lpModalOverlay"></div>
    </div>
</template>

<script>
const modalMixin = require("../mixins/modal-mixin.js");

export default {
    name: "help",
    mixins: [modalMixin],
    data: function() {
        return {
        }
    },
    beforeMount: function() {
        bus.$on("showTodo", () => {
            this.openModal();
        });
    }
}
</script>
