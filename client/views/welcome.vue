<style lang="scss">

</style>

<template>
    <div id="welcomeContainer">
        <div class="lpDialog alwaysShow sticky" id="welcome">
            <h2><strong>LighterPack</strong> helps you track the gear you bring on adventures.</h2>
            <div class="columns">
                <div class="lpHalf">
                    <h3>Register an Account</h3>

                    <registerForm></registerForm>
                    <a class="lpHref lpGetStarted" v-on:click="loadLocal">Skip Registration</a>
                    <router-link to="/signin" class="lpHref">Already registered?</router-link>
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
import registerForm from "../components/register-form.vue";
const dataTypes = require("../dataTypes.js");
const Library = dataTypes.Library;

export default {
    name: "welcome",
    mixins: [],
    components: {
        blackoutFooter: blackoutFooter,
        registerForm: registerForm
    },
    data: function() {
        return {
        }
    },
    methods: {
        loadLocal: function() {
            var library = new Library();
            this.$store.commit('loadLibraryData', JSON.stringify(library.save()));
            this.$store.commit('setSaveType', "local");
            this.$store.commit("setLoggedIn", false)
            router.push("/");
        }
    },
    beforeMount: function() {
        if (this.$store.state.library) {
            router.push("/");
        }
    }
}
</script>