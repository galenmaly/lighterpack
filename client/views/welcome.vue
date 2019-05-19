<style lang="scss">
@import "../css/_globals";

#welcome {
    border-top: 2px solid $orange1;
    width: 700px;

    h2 {
        font-weight: normal;

        strong {
            font-size: 24px;
        }
    }

    h3 {
        margin-bottom: $spacingMedium;
    }

    .lpError {
        margin: 0 0 12px;
    }

    .lpHalf {
        min-height: 260px;
        position: relative;
    }

    input[type="text"],
    input[type="email"],
    input[type="password"] {
        background: rgba(255, 255, 255, 0.8);
        width: 100%;
    }

    .lpHref {
        display: inline-block;
        font-size: 15px;
        font-weight: bold;
        margin: 15px 0 0;
        text-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
    }
}

#lpWelcomeRegisterContainer {
    width: 58%;
}

#lpValuePropContainer {
    width: 42%;
}

#lpValueProp {
    margin: 30px 0;
    padding: 0;

    li {
        list-style-type: none;
        margin: 0 0 15px;
    }

    h3 {
        strong {
            font-size: 20px;
            margin-right: 5px;
        }
    }
}

#valueChart {
    margin: 0 0 0 10px;
}

</style>

<template>
    <div id="welcomeContainer">
        <modal id="welcome" :shown="true" :blackout="true">
            <h2><strong>LighterPack</strong> helps you track the gear you bring on adventures.</h2>
            <div class="columns">
                <div id="lpWelcomeRegisterContainer" class="lpHalf">
                    <h3>Register an Account</h3>

                    <registerForm />
                    <a class="lpHref lpGetStarted" @click="loadLocal">Skip Registration</a><br>
                    <router-link to="/signin" class="lpHref">
                        Already registered?
                    </router-link>
                </div>
                <div id="lpValuePropContainer" class="lpHalf">
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
                                <canvas id="valueChart" height="150" width="150" />
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </modal>

        <blackoutFooter />
    </div>
</template>

<script>
import blackoutFooter from '../components/blackout-footer.vue';
import modal from '../components/modal.vue';
import registerForm from '../components/register-form.vue';

const pies = require('../pies.js');
const dataTypes = require('../dataTypes.js');

const Library = dataTypes.Library;

export default {
    name: 'Welcome',
    components: {
        blackoutFooter,
        modal,
        registerForm,
    },
    data() {
        return {
            openTimeout: null,
            closeTimeout: null,
        };
    },
    beforeMount() {
        if (this.$store.state.library) {
            router.push('/');
        }
    },
    mounted() {
        const data = {
            Sleep: {
                Tent: 33,
                'Sleeping Pad': 14,
                'Sleeping Bag': 24,
                Eyemask: 3,
                Pillow: 5,
            },
            Clothes: {
                'Rain Jacket': 13,
                Pants: 16,
                Shirt: 7,
                Socks: 3,
                Hat: 2,
                Gloves: 3,
                'Down Jacket': 10,
            },
            Electronics: {
                Camera: 16,
                'Battery Pack': 12,
                'USB Cable': 1,
            },
        };

        const chart = pies({
            data,
            container: document.getElementById('valueChart'),
            hoverCallback: () => {
                clearTimeout(this.openTimeout);
                clearTimeout(this.closeTimeout);
            },
        });

        this.openTimeout = setTimeout(() => { chart.open('Sleep'); }, 4000);
        this.closeTimeout = setTimeout(() => { chart.close(); }, 8000);
    },
    methods: {
        loadLocal() {
            const library = new Library();
            this.$store.commit('loadLibraryData', JSON.stringify(library.save()));
            this.$store.commit('setSaveType', 'local');
            this.$store.commit('setLoggedIn', false);
            router.push('/');
        },
    },
};
</script>
