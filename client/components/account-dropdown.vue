<style lang="scss">
#headerPopover .lpContent {
    min-width: 9em;
}
</style>

<template>
    <span id="account">
        <span v-if="isSignedIn" class="headerItem hasPopover">
            <PopoverHover id="headerPopover">
                <span slot="target">Signed in as <span class="username">{{ username }}</span> <i class="lpSprite lpExpand" /></span>
                <div slot="content">
                    <a class="lpHref accountSettings" @click="showAccount">Account Settings</a><br>
                    <a class="lpHref" @click="showHelp">Help</a><br>
                    <a class="lpHref signout" @click="signout">Sign Out</a>
                </div>
            </PopoverHover>
        </span>
        <span v-if="!isSignedIn" class="headerItem">
            <router-link to="/register" class="lpButton lpSmall">Register</router-link>
            or
            <router-link to="/signin" class="lpButton lpSmall">Sign In</router-link>
        </span>
    </span>
</template>

<script>
import PopoverHover from './popover-hover.vue';

export default {
    name: 'AccountDropdown',
    components: {
        PopoverHover,
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        isSignedIn() {
            return this.$store.state.loggedIn;
        },
        username() {
            return this.$store.state.loggedIn;
        },
    },
    methods: {
        showAccount() {
            bus.$emit('showAccount');
        },
        showHelp() {
            bus.$emit('showHelp');
        },
        signout() {
            this.$store.commit('signout');
            router.push('/signin');
        },
    },
};
</script>
