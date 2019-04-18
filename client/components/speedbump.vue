<style lang="scss">

</style>

<template>
    <modal :shown="shown" @hide="shown = false" id="speedbump">
        <h2 v-if="messages.title">{{messages.title}}</h2>

        <p>{{messages.body}}</p>

        <div class="buttons">
            <button class="lpButton" @click="confirmSpeedbump()" v-focus-on-create>{{messages.confirm}}</button>
            &nbsp;<button class="lpButton" @click="shown = false">{{messages.cancel}}</button>
        </div>
    </modal>
</template>

<script>
import modal from "./modal.vue";

export default {
    name: "speedbump",
    components: {
        modal
    },
    data: function() {
        return {
            defaultMessages: {
                title: "",
                body: "",
                confirm: "Yes",
                cancel: "No"
            },
            messages: {},
            callback: null,
            shown: false
        }
    },
    methods: {
        initSpeedbump: function(callback, options) {
            this.callback = callback;
            this.messages = Vue.util.extend({}, this.defaultMessages);
            if (typeof options === "string") {
                this.messages.body = options;
            } else {
                this.messages = Vue.util.extend(this.messages, options);
            }
            this.shown = true;
        },
        confirmSpeedbump: function() {
            if (this.callback && typeof this.callback === "function") {
                this.callback(true);
            }
            this.shown = false;
        },
    },
    beforeMount: function() {
        bus.$on("initSpeedbump", (callback, options) => {
            this.initSpeedbump(callback, options);
        });
    }
}
</script>