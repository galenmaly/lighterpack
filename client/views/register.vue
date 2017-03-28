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
            <form class="register">
                <div class="lpError"></div>
                <input type="text" placeholder="Username" name="username" class="username"/>
                <input type="email" placeholder="Email" name="email" class="email"/>
                <input type="password" placeholder="Password" name="password" class="password"/>
                <input type="password" placeholder="Confirm Password" name="passwordConfirm" class="passwordConfirm"/>
                <input type="submit" value="Register" class="lpButton" />
                <span class="status"></span>
            </form>
        </div>

        <blackoutFooter></blackoutFooter>
        <modalBlackout></modalBlackout>
    </div>
</template>

<script>
import blackoutFooter from "../components/blackout-footer.vue";
import modalBlackout from "../components/modal-blackout.vue";

export default {
    name: "register",
    mixins: [],
    components: {
        blackoutFooter: blackoutFooter,
        modalBlackout: modalBlackout
    },
    data: function() {
        return {
        }
    },
    beforeMount: function() {
    }
}
</script>