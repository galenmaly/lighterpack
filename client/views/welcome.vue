<style lang="scss">
@import "../css/_globals";

$welcomeVerticalSpacing: 80px;

#lpWelcomeContainer {
    background: #385f8b url("/images/lp_bg2.jpg") 50% 50%;
    background-size: cover;
    min-height: 100vh;
    padding-top: $welcomeVerticalSpacing;
}

#lpWelcome {
    h1 {
        color: #fff;
        font-size: 28px;
        font-weight: normal;
        margin: 0 0 $welcomeVerticalSpacing;
        text-align: center;

        strong {
            font-size: 36px;
        }
    }

    .lpError {
        margin: 0 0 12px;
    }
}

.lpContainer {
    margin: 0 auto;
    max-width: 900px;
    padding: 0 $spacingMedium;
}

.lpWelcomeContent {
    align-items: flex-start;
    display: flex;
    justify-content: space-between;
}

.lpWelcomeRegisterContainer,
.lpWelcomeSigninContainer {
    background: rgba(255, 255, 255, 0.9);
    border-top: 2px solid $orange1;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.25);
    padding: $spacingLarge;

    .lpWelcomeContainerHeader {
        font-size: 20px;
    }
}

.lpWelcomeRegisterContainer {
    display: flex;
    flex: 0 0 550px;
    margin-right: $spacingLarge;
}

.lpWelcomeSigninContainer {
    flex: 0 0 275px;
}

.lpWelcomeRegister {
    flex: 0 0 46%;
    margin-right: $spacingLarge;
}

#lpValueProp {
    margin: 38px 0 $spacingMedium;
    padding: 0;

    li {
        list-style-type: none;
        margin: 0 0 14px;
    }

    h3 {
        margin: 0;

        strong {
            font-size: 20px;
            margin-right: 5px;
        }
    }
}

#lpWelcomeScreenshot {
    box-shadow: 0 3px 5px 2px rgba(0, 0, 0, 0.3);
    max-width: 96%; //visual alignment with content
}

#lpLaunchBanner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: $yellow1;
    padding: $spacingSmall;
    text-align: center;
}

</style>

<template>
    <div id="lpWelcomeContainer">
        <div id="lpLaunchBanner">
            <div class="lpContainer">
                <strong>Welcome to the new version of LighterPack!</strong> We hope you like it, and if you have any questions please <a href="mailto:info@lighterpack.com" class="lpHref">get in touch</a>.
            </div>
        </div>
        <div id="lpWelcome" class="lpContainer">
            <h1><strong>LighterPack</strong> helps you track the gear you bring on adventures.</h1>
            <div class="lpWelcomeContent">
                <div class="lpWelcomeRegisterContainer">
                    <div class="lpWelcomeRegister">
                        <h3 class="lpWelcomeContainerHeader">
                            Register an account
                        </h3>
                        <registerForm />
                    </div>
                    <div class="lpValuePropContainer">
                        <ul id="lpValueProp">
                            <li id="valueEnter">
                                <h3><strong>1.</strong>Enter your packing lists</h3>
                            </li>
                            <li id="valueVisualize">
                                <h3><strong>2.</strong>Visualize your pack weights</h3>
                            </li>
                            <li id="valueShare">
                                <h3><strong>3.</strong>Share your lists with others</h3>
                            </li>
                        </ul>
                        <img id="lpWelcomeScreenshot" src="/images/screenshot.jpg" alt="A screenshot of the LighterPack interface">
                    </div>
                </div>
                <div class="lpWelcomeSigninContainer">
                    <h3 class="lpWelcomeContainerHeader">
                        Sign in
                    </h3>
                    <SigninForm />
                </div>
            </div>
        </div>

        <globalAlerts />
        <blackoutFooter />
    </div>
</template>

<script>
import blackoutFooter from '../components/blackout-footer.vue';
import globalAlerts from '../components/global-alerts.vue';
import modal from '../components/modal.vue';
import registerForm from '../components/register-form.vue';
import SigninForm from '../components/signin-form.vue';

export default {
    name: 'Welcome',
    components: {
        blackoutFooter,
        globalAlerts,
        modal,
        registerForm,
        SigninForm,
    },
    beforeMount() {
        if (this.$store.state.library) {
            router.push('/');
        }
    },
};
</script>
