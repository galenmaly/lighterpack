<style lang="scss">
@import "../css/_globals";

.lpModal {
    background: $background1;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.2);
    left: 50%;
    max-height: calc(90% - (#{$spacingLarge} * 2));
    overflow-y: auto;
    padding: $spacingLarge;
    position: fixed;
    text-align: left;
    top: 50%;
    transform: translateX(-50%) translateY(-50%);
    transition: all $transitionDuration;
    width: 420px;
    z-index: $dialog;

    .lpHalf {
        padding: 0 20px;

        &:first-child {
            padding-left: 0;
        }

        &:last-child {
            padding-right: 0;
        }
    }

    p {
        margin: 5px 0 10px;
    }

    ul {
        padding-left: 15px;
    }

    .lpContent {
        max-height: 400px;
        overflow-y: scroll;
    }
}

.lpModalHeader {
    display: flex;
    justify-content: space-between;
}

.lpModalOverlay {
    background: rgba(0, 0, 0, 0.5);
    height: 100%;
    left: 0;
    position: fixed;
    top: 0;
    transition: all $transitionDuration;
    width: 100%;
    z-index: $belowDialog;

    &.lpBlackout {
        animation: none;
        background: url("/images/lp_bg2.jpg") 50% 50%;
        background-size: cover;
        opacity: 1;
    }

    &.lpTransparent {
        background: rgba(0, 0, 0, 0.01);
    }
}

.lpModal-enter,
.lpModal-leave-active {
    opacity: 0;

    &.lpModal {
        transform: translateX(-50%) translateY(-50%) scale(0.95);
    }
}

</style>

<template>
    <div class="lpModalContainer">
        <transition name="lpModal">
            <div v-if="shown" :id="id" class="lpModal">
                <slot />
            </div>
        </transition>
        <transition name="lpModal">
            <div v-if="shown" :class="{'lpModalOverlay': true, 'lpBlackout': blackout, 'lpTransparent': transparentOverlay}" @click="hide" />
        </transition>
    </div>
</template>

<script>
export default {
    name: 'Modal',
    props: {
        id: {
            type: String,
            required: false,
        },
        shown: {
            type: Boolean,
            required: true,
        },
        blackout: {
            type: Boolean,
            required: false,
            default: false,
        },
        transparentOverlay: {
            type: Boolean,
            required: false,
            default: false,
        },
    },
    beforeMount() {
        this.bindEscape();
    },
    beforeDestroy() {
        this.unbindEscape();
    },
    methods: {
        hide() {
            this.$emit('hide');
        },
        bindEscape() {
            window.addEventListener('keyup', this.closeOnEscape);
        },
        unbindEscape() {
            window.removeEventListener('keyup', this.closeOnEscape);
        },
        closeOnEscape(evt) {
            if (this.shown && evt.keyCode === 27) {
                this.hide();
            }
        },
    },
};
</script>
