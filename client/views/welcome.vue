<style lang="scss">

</style>

<template>
    <div id="welcomeContainer">
        <div class="lpDialog alwaysShow sticky" id="welcome">
            <h2><strong>LighterPack</strong> helps you track the gear you bring on adventures.</h2>
            <div class="columns">
                <div class="lpHalf" id="lpWelcomeRegisterContainer">
                    <h3>Register an Account</h3>

                    <registerForm></registerForm>
                    <a class="lpHref lpGetStarted" v-on:click="loadLocal">Skip Registration</a>
                    <router-link to="/signin" class="lpHref">Already registered?</router-link>
                </div>
                <div class="lpHalf" id="lpValuePropContainer">
                    <ul id="lpValueProp">
                        <li id="valueEnter">
                            <h3><strong>1.</strong>Enter your packing lists</h3>
                        </li>
                        <li id="valueVisualize">
                            <h3><strong>2.</strong>Visualize your pack weights</h3>
                        </li>
                        <li id="valueShare">
                            <h3><strong>3.</strong>Share your lists with others</h3>
                            <div id="valueChartContainer">
                                <canvas id="valueChart" height="150" width="150"></canvas>
                            </div>
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
const pies = require("../pies.js");
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
            openTimeout: null,
            closeTimeout: null
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
    },
    mounted: function() {
         var data = {
             "Sleep": {
                 "Tent": 33,
                 "Sleeping Pad": 14,
                 "Sleeping Bag": 24,
                 "Eyemask": 3,
                 "Pillow": 5
             },
             "Clothes": {
                 "Rain Jacket": 13,
                 "Pants": 16,
                 "Shirt": 7,
                 "Socks": 3,
                 "Hat": 2,
                 "Gloves": 3,
                 "Down Jacket": 10
             },
             "Electronics": {
                 "Camera": 16,
                 "Battery Pack": 12,
                 "USB Cable": 1
             }
         }
 
         var chart = pies({data: data, container: document.getElementById("valueChart"), hoverCallback: () => {
            clearTimeout(this.openTimeout);
            clearTimeout(this.closeTimeout);
         }});
 
         this.openTimeout = setTimeout(function() { chart.open("Sleep");}, 4000);
         this.closeTimeout = setTimeout(function() { chart.close();}, 8000);
         
    }
}
</script>