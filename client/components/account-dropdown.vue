<style lang="scss">

</style>

<template>
    <span id="account">
        <span v-if="isSignedIn" id="account" class="headerItem hasFlyout">
            <span class="lpFlyout">
                <span class="lpTarget">Signed in as <span class="username">{{ username }}</span> <i class="lpSprite lpExpand" /></span>
                <div class="lpContent">
                    <a class="lpHref accountSettings" @click="showAccount">Account Settings</a><br>
                    <a class="lpHref" @click="showHelp">Help</a><br>
                    <a class="lpHref signout" @click="signout">Sign Out</a>
                </div>
            </span>
        </span>
        <span v-if="!isSignedIn" class="headerItem">
            <router-link to="/register" class="lpButton lpSmall">Register</router-link>
            or
            <router-link to="/signin" class="lpButton lpSmall">Sign In</router-link>
        </span>
    </span>
</template>

<script>

export default {
    name: 'AccountDropdown',
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
