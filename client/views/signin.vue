<style lang="scss">

</style>

<template>
    <div id="signinContainer">
        <modal id="signin" :shown="true" :blackout="true">
            <div class="lpModalHeader">
                <h2>
                    Sign in
                </h2>
                <router-link to="/register" class="lpHref">
                    Need to register?
                </router-link>
            </div>
            <SigninForm :message="message" />
        </modal>

        <blackoutFooter />
        <globalAlerts />
    </div>
</template>

<script>
import blackoutFooter from '../components/blackout-footer.vue';
import globalAlerts from '../components/global-alerts.vue';
import modal from '../components/modal.vue';
import SigninForm from '../components/signin-form.vue';

export default {
    name: 'Signin',
    components: {
        blackoutFooter,
        globalAlerts,
        modal,
        SigninForm,
    },
    computed: {
        message() {
            if (this.$route.path.indexOf('/reset-password') > -1 || this.$route.path.indexOf('/forgot-username') > -1) {
                return 'An email has been sent to the address associated with your account. Note: emails to yahoo.com addresses are currently being blocked. Please reach out to info@lighterpack.com for assistance if you do not receive your email.';
            }
            return '';
        },
    },
};
</script>
