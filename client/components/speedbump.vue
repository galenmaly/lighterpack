<style lang="scss">

</style>

<template>
    <modal id="speedbump" :shown="shown" @hide="$emit('hide')">
        <h2 v-if="messages.title">
            {{ messages.title }}
        </h2>

        <p>{{ messages.body }}</p>

        <div class="buttons">
            <button v-focus-on-create class="lpButton" @click="confirmSpeedbump()">
                {{ messages.confirm }}
            </button>
            &nbsp;<button class="lpButton" @click="$emit('hide')">
                {{ messages.cancel }}
            </button>
        </div>
    </modal>
</template>

<script>
import modal from './modal.vue';

const defaultMessages = {
    title: '',
    body: '',
    confirm: 'Yes',
    cancel: 'No',
};

export default {
    name: 'Speedbump',
    components: {
        modal,
    },
    props: {
        shown: {
            type: Boolean,
            required: true,
        },
        speedbumpCallback: {
            type: Function,
            default: null,
        },
        speedbumpOptions: {
            type: [Object, String],
            default: null,
        },
    },
    emits: ['hide'],
    computed: {
        messages() {
            const msgs = Object.assign({}, defaultMessages);
            if (!this.speedbumpOptions) return msgs;
            if (typeof this.speedbumpOptions === 'string') {
                msgs.body = this.speedbumpOptions;
            } else {
                Object.assign(msgs, this.speedbumpOptions);
            }
            return msgs;
        },
    },
    methods: {
        confirmSpeedbump() {
            if (this.speedbumpCallback && typeof this.speedbumpCallback === 'function') {
                this.speedbumpCallback(true);
            }
            this.$emit('hide');
        },
    },
};
</script>
