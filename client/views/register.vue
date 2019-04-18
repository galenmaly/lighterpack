<style lang="scss">

</style>

<template>
    <div id="registerContainer">
        <modal :shown="true" :blackout="true" id="register">
            <div class="lpModalHeader">
                <h2>
                    Register an Account
                </h2>
                <router-link to="/signin" class="lpHref">Already registered?</router-link>
            </div>

            <!-- TODO -->
            <!--<span class="info existingData"> 
                Your existing data will be saved to your new account upon creation.
            </span>-->

            <registerForm></registerForm>
        </modal>

        <blackoutFooter></blackoutFooter>
    </div>
</template>

<script>
import blackoutFooter from "../components/blackout-footer.vue";
import modal from "../components/modal.vue";
import registerForm from "../components/register-form.vue";

export default {
    name: "register",
    components: {
        blackoutFooter,
        modal,
        registerForm
    }
}
</script>
