<style lang="scss">

</style>

<template>
    <div id="registerContainer">
        <div class="lpDialog" id="register">
            <h2>
                Register an Account
                <router-link to="/signin"><a class="lpHref alternateAction">Already registered?</a></router-link>
            </h2>

            <span class="info existingData">
                Your existing data will be saved to your new account upon creation.
            </span>
            <registerForm></registerForm>
        </div>

        <blackoutFooter></blackoutFooter>
        <div class="lpModalOverlay lpBlackout"></div>
    </div>
</template>

<script>
import blackoutFooter from "../components/blackout-footer.vue";
import registerForm from "../components/register-form.vue";

export default {
    name: "register",
    mixins: [],
    components: {
        blackoutFooter: blackoutFooter,
        registerForm: registerForm
    },
    data: function() {
        return {
        }
    },
    beforeMount: function() {
    }
}
</script>
