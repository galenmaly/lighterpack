<style lang="scss">

</style>

<template>
    <div id="welcomeContainer">
        <div class="lpDialog alwaysShow sticky" id="welcome">
            <h2><strong>LighterPack</strong> helps you track the gear you bring on adventures.</h2>
            <div class="columns">
                <div class="lpHalf">
                    <h3>Register an Account</h3>
                    <form class="register">
                        <div class="lpError"></div>
                        <input type="text" placeholder="Username" name="username" class="username"/>
                        <input type="email" placeholder="Email" name="email" class="email"/>
                        <input type="password" placeholder="Password" name="password" class="password"/>
                        <input type="password" placeholder="Confirm Password" name="passwordConfirm" class="passwordConfirm"/>
                        <div class="lpButtons">
                            <input type="submit" value="Register" class="lpButton" />
                            <a class="lpHref lpGetStarted" href="#">Skip Registration</a>
                            <span class="status"></span>
                            <router-link to="/signin"><a class="lpHref alternateAction">Already registered?</a></router-link>
                        </div>
                    </form>
                </div>
                <div class="lpHalf">
                    <ul id="lpValueProp">
                        <li id="valueEnter">
                            <h3>Enter your packing lists</h3>
                        </li>
                        <li id="valueVisualize">
                            <h3>Visualize your pack weights</h3>
                            <canvas class="valueChart" height="100" width="100"></canvas>
                        </li>
                        <li id="valueShare">
                            <h3>Share your lists with others</h3>
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <blackoutFooter></blackoutFooter>
        <div class="lpModalOverlay lpBlackout"></div>
    </div>
</template>

<script>
import blackoutFooter from "../components/blackout-footer.vue";

export default {
    name: "welcome",
    mixins: [],
    components: {
        blackoutFooter: blackoutFooter
    },
    data: function() {
        return {
        }
    },
    beforeMount: function() {
    }
}
</script>