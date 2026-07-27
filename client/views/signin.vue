<template>
    <div id="signinContainer">
        <modal id="signin" class="lpAuthCard" :shown="true" :blackout="true">
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

        <siteFooter fixed />
        <globalAlerts />
    </div>
</template>

<script>
import siteFooter from '../components/site-footer.vue';
import globalAlerts from '../components/global-alerts.vue';
import modal from '../components/modal.vue';
import SigninForm from '../components/signin-form.vue';

export default {
    name: 'Signin',
    components: {
        siteFooter,
        globalAlerts,
        modal,
        SigninForm,
    },
    computed: {
        message() {
            const deliveryNote = ' Note: emails to yahoo.com addresses are currently being blocked. Please reach out to info@lighterpack.com for assistance if you do not receive your email.';

            if (this.$route.path.indexOf('/reset-password') > -1) {
                return `A password reset link has been sent to the address associated with your account. The link expires in one hour.${deliveryNote}`;
            }

            if (this.$route.path.indexOf('/forgot-username') > -1) {
                return `An email has been sent to the address associated with your account.${deliveryNote}`;
            }

            return '';
        },
    },
};
</script>

<style lang="scss">

</style>
