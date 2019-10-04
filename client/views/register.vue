<style lang="scss">

</style>

<template>
    <div id="registerContainer">
        <modal id="register" :shown="true" :blackout="true">
            <div class="lpModalHeader">
                <h2>
                    Register an account
                </h2>
                <router-link to="/signin" class="lpHref">
                    Already registered?
                </router-link>
            </div>

            <p class="lpWarning" v-if="isLocalSaving">
                <strong>Note:</strong> Your existing data on your computer <strong>will</strong> be saved to your new account.
            </p>

            <registerForm />
        </modal>

        <blackoutFooter />
    </div>
</template>

<script>
import blackoutFooter from '../components/blackout-footer.vue';
import modal from '../components/modal.vue';
import registerForm from '../components/register-form.vue';

export default {
    name: 'Register',
    components: {
        blackoutFooter,
        modal,
        registerForm,
    },
    
    computed: {
        isLocalSaving() {
            return this.$store.state.saveType === 'local';
        },
    },
};
</script>
