<style lang="scss">

</style>

<template>
    <modal id="speedbump" :shown="shown" @hide="shown = false">
        <h2 v-if="messages.title">
            {{ messages.title }}
        </h2>

        <p>{{ messages.body }}</p>

        <div class="buttons">
            <button v-focus-on-create class="lpButton" @click="confirmSpeedbump()">
                {{ messages.confirm }}
            </button>
            &nbsp;<button class="lpButton" @click="shown = false">
                {{ messages.cancel }}
            </button>
        </div>
    </modal>
</template>

<script>
import modal from './modal.vue';

export default {
    name: 'Speedbump',
    components: {
        modal,
    },
    data() {
        return {
            defaultMessages: {
                title: '',
                body: '',
                confirm: 'Yes',
                cancel: 'No',
            },
            messages: {},
            callback: null,
            shown: false,
        };
    },
    beforeMount() {
        bus.$on('initSpeedbump', (callback, options) => {
            this.initSpeedbump(callback, options);
        });
    },
    methods: {
        initSpeedbump(callback, options) {
            this.callback = callback;
            this.messages = Vue.util.extend({}, this.defaultMessages);
            if (typeof options === 'string') {
                this.messages.body = options;
            } else {
                this.messages = Vue.util.extend(this.messages, options);
            }
            this.shown = true;
        },
        confirmSpeedbump() {
            if (this.callback && typeof this.callback === 'function') {
                this.callback(true);
            }
            this.shown = false;
        },
    },
};
</script>
