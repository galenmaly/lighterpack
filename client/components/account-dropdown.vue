<template>
    <span class="headerItem hasPopover">
        <PopoverHover id="headerPopover">
            <template #target><span>Signed in as <span class="username">{{ username }}</span> <i class="lpSprite lpExpand" /></span></template>
            <template #content>
                <div>
                    <a class="lpHref accountSettings" @click="showAccount">Account Settings</a><br>
                    <a class="lpHref" @click="showHelp">Help</a><br>
                    <a class="lpHref signout" @click="signout">Sign Out</a>
                </div>
            </template>
        </PopoverHover>
    </span>
</template>

<script>
import PopoverHover from './popover-hover.vue';

export default {
    name: 'AccountDropdown',
    components: {
        PopoverHover,
    },
    inject: ['openAccount', 'openHelp'],
    computed: {
        library() {
            return this.$store.state.library;
        },
        username() {
            return this.$store.state.loggedIn;
        },
    },
    methods: {
        showAccount() {
            this.openAccount();
        },
        showHelp() {
            this.openHelp();
        },
        signout() {
            this.$store.commit('signout');
            this.$router.push('/signin');
        },
    },
};
</script>

<style lang="scss">
#headerPopover .lpContent {
    min-width: 9em;
}
</style>
