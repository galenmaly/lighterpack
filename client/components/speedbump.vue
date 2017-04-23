<style lang="scss">
#speedbump {
    p {
        margin: 30px 0;
    }
}
</style>

<template>
    <div v-if="shown">
        <div id="speedbump" :class="'lpDialog ' + modalClasses">
            <h2>{{messages.title}}</h2>

            <p>{{messages.body}}</p>

            <div class="buttons">
                <button class="lpButton" v-on:click="confirmSpeedbump()">{{messages.confirm}}</button>
                &nbsp;<button class="lpButton" v-on:click="closeModal()">{{messages.cancel}}</button>
            </div>
        </div>
        <div v-on:click="closeModal" :class="'lpModalOverlay ' + modalClasses"></div>
    </div>
</template>

<script>
const modalMixin = require("../mixins/modal-mixin.js");

module.exports = {
    name: "speedbump",
    mixins: [modalMixin],
    data: function() {
        return {
            defaultMessages: {
                title: "",
                body: "",
                confirm: "Yes",
                cancel: "No"
            },
            messages: {},
            callback: null
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
            this.openModal();
        },
        confirmSpeedbump: function() {
            if (this.callback && typeof this.callback === "function") {
                this.callback(true);
            }
            this.closeModal();
        },
    },
    beforeMount: function() {
        bus.$on("initSpeedbump", (callback, options) => {
            this.initSpeedbump(callback, options);
        });
    }
}
</script>