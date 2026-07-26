<template>
    <div id="lpWelcomeContainer" :class="{ lpWelcomeIsMobile: isMobile }">
        <!-- Phone layout: one column, auth card first. The two layouts are
             mutually exclusive rather than one reflowed DOM, because the card
             tabs pair the two forms that sit in separate panels on desktop. -->
        <div v-if="isMobile" id="lpWelcomeMobile">
            <div class="lpMobileHero">
                <div class="lpMobileWordmark">
                    LighterPack
                </div>
                <!-- Shortened from the desktop headline: the wordmark directly
                     above already supplies the subject. -->
                <h1 class="lpMobileHeadline">
                    Track the gear you bring on adventures.
                </h1>

                <div class="lpMobileCard">
                    <div class="lpMobileTabs" role="tablist">
                        <button
                            id="lpMobileTabSignin" type="button" role="tab"
                            :aria-selected="activeTab === 'signin'" aria-controls="lpMobilePanelSignin"
                            :class="{ lpMobileTabActive: activeTab === 'signin' }"
                            @click="activeTab = 'signin'"
                        >
                            Sign in
                        </button>
                        <button
                            id="lpMobileTabRegister" type="button" role="tab"
                            :aria-selected="activeTab === 'register'" aria-controls="lpMobilePanelRegister"
                            :class="{ lpMobileTabActive: activeTab === 'register' }"
                            @click="activeTab = 'register'"
                        >
                            Register
                        </button>
                    </div>

                    <!-- v-show, not v-if: switching tabs keeps whatever the
                         other tab already had typed into it. -->
                    <div class="lpMobileCardBody">
                        <div
                            v-show="activeTab === 'signin'" id="lpMobilePanelSignin"
                            role="tabpanel" aria-labelledby="lpMobileTabSignin"
                        >
                            <SigninForm :autofocus="false" />
                        </div>
                        <div
                            v-show="activeTab === 'register'" id="lpMobilePanelRegister"
                            role="tabpanel" aria-labelledby="lpMobileTabRegister"
                        >
                            <registerForm :autofocus="false" />
                        </div>
                    </div>

                    <!-- Shared by both tabs; it must not appear to move when
                         the form above it changes height. -->
                    <div class="lpMobileAnon">
                        or <a class="lpMobileAnonLink" @click="startWithoutAccount">start a list without an account</a>
                    </div>
                </div>
            </div>

            <div class="lpMobileBody">
                <!-- The label is what keeps the three imperative lines below
                     reading as a description of the product rather than as
                     instructions with no object. -->
                <h2 class="lpMobileSectionLabel">
                    How it works
                </h2>
                <ol class="lpMobileSteps">
                    <li><strong>1.</strong> <span>Enter your packing lists</span></li>
                    <li><strong>2.</strong> <span>Visualize your pack weights</span></li>
                    <li><strong>3.</strong> <span>Share your lists with others</span></li>
                </ol>
                <div class="lpMobileShot">
                    <img :src="'/images/screenshot.jpg'" alt="A screenshot of the LighterPack interface">
                </div>
            </div>

            <siteFooter class="lpMobileFooter" />
        </div>

        <div v-else id="lpWelcome" class="lpContainer">
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
                        <img id="lpWelcomeScreenshot" :src="'/images/screenshot.jpg'" alt="A screenshot of the LighterPack interface">
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
        <!-- The fixed footer would sit on top of the phone layout, which ends
             in a footer of its own. -->
        <siteFooter v-if="!isMobile" fixed />
    </div>
</template>

<script>
import globalAlerts from '../components/global-alerts.vue';
import registerForm from '../components/register-form.vue';
import SigninForm from '../components/signin-form.vue';
import siteFooter from '../components/site-footer.vue';
import isMobile from '../utils/viewport.js';

export default {
    name: 'Welcome',
    components: {
        globalAlerts,
        registerForm,
        SigninForm,
        siteFooter,
    },
    data() {
        return {
            activeTab: 'signin',
        };
    },
    computed: {
        // The card pairs two forms that live in separate panels on desktop, so
        // it cannot be a reflow of the desktop DOM -- this is the same
        // component-swap the item row and list summary use.
        isMobile() {
            return isMobile.value;
        },
    },
    beforeMount() {
        if (this.$store.state.library) {
            this.$router.push('/');
            return;
        }
        // Arriving with a register intent opens on that tab instead.
        if (this.$route.query.register !== undefined) {
            this.activeTab = 'register';
        }
    },
    methods: {
        startWithoutAccount() {
            this.$store.dispatch('startLocalLibrary');
            this.$router.push('/');
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

$welcomeVerticalSpacing: 80px;
$mobileGutter: 20px;
$mobileCardGutter: 16px;
$mobileCardPadding: 18px;
// $mobile reaches 720px, well past the ~600px this layout was drawn for, so the
// column is capped: full-bleed at the top of that range would put 690px-wide
// fields on screen. Below the cap the gutters behave exactly as drawn.
$mobileColumn: 520px;
$mobileColumnOuter: $mobileColumn + $mobileGutter * 2;

#lpWelcomeContainer {
    background: #385f8b var(--lp-page-bg-url) 50% 50%;
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
    background: var(--lp-welcome-panel-bg);
    border-top: 2px solid var(--lp-accent-orange);
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
    max-width: 96%; // visual alignment with content
}

// ============================================================
// Phone layout, at the app-wide $mobile breakpoint. Every color here
// comes from an existing semantic token, so the page follows the theme
// the same way the rest of the app does; only the geometry is new.
// ============================================================

#lpWelcomeContainer.lpWelcomeIsMobile {
    // The photograph belongs to the hero block here, not to the whole page:
    // the sections below it are opaque content surfaces.
    background: var(--lp-bg);
    padding-top: 0;
}

.lpMobileHero {
    background: #385f8b var(--lp-page-bg-url) 50% 50%;
    background-size: cover;
    padding-bottom: 24px;
}

// Capped alongside the card so the hero type stays on the column's left edge
// rather than drifting to the viewport's at the top of the range.
.lpMobileWordmark,
.lpMobileHeadline {
    color: #fff;
    margin: 0 auto;
    max-width: $mobileColumnOuter;
}

.lpMobileWordmark {
    font-size: 17px;
    font-weight: 700;
    padding: 16px $mobileGutter 0;
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.45);
}

.lpMobileHeadline {
    font-size: 24px;
    font-weight: 400;
    line-height: 1.24;
    padding: 18px $mobileGutter 22px;
    text-shadow: 0 1px 14px rgba(0, 0, 0, 0.5);
}

.lpMobileCard {
    background: var(--lp-surface);
    border: 1px solid var(--lp-border);
    border-radius: 7px;
    box-shadow: var(--lp-lift-shadow);
    margin: 0 auto;
    max-width: $mobileColumn;
    overflow: hidden;
    width: calc(100% - #{$mobileCardGutter * 2});
}

.lpMobileTabs {
    background: var(--lp-row-hover);
    border-bottom: 1px solid var(--lp-border);
    display: flex;

    button {
        appearance: none;
        background: none;
        border: none;
        color: var(--lp-text-secondary);
        cursor: pointer;
        flex: 1;
        font-size: 15px;
        font-weight: 600;
        height: 46px;
        padding: 0;

        &:focus {
            outline: none;
        }
    }

    .lpMobileTabActive {
        background: var(--lp-surface);
        // The product's affordance for a live control is the orange rule alone.
        box-shadow: inset 0 -2.5px 0 var(--lp-accent-orange);
        color: var(--lp-text);
        font-weight: 700;
    }
}

.lpMobileCardBody {
    padding: 16px $mobileCardPadding $mobileCardPadding;

    // The shared field and button rules from _utilities, sized up for touch.
    // 16px on the inputs is load-bearing: anything smaller makes iOS zoom the
    // page when a field takes focus.
    .lpFields {
        input[type="text"],
        input[type="email"],
        input[type="password"] {
            border: 1px solid var(--lp-border-strong);
            border-radius: 6px;
            font-size: 16px;
            height: 48px;
            margin: 0 0 10px;
            padding: 0 13px;

            &:focus {
                border-color: var(--lp-accent-orange);
                // Heavier border, compensating padding, so text does not shift.
                border-width: 1.5px;
                padding: 0 12.5px;
            }

            &:last-child {
                margin-bottom: 0;
            }
        }
    }

    .lpError {
        margin: 10px 0 0;
    }

    .lpButtons {
        margin-top: 12px;

        > * {
            margin-bottom: 0;
        }
    }

    .lpButton {
        border-radius: 6px;
        font-size: 16px;
        font-weight: 700;
        height: 48px;
        padding: 0;
    }

    // The forgot link becomes its own 40px row under the button. The underline
    // sits on the glyphs rather than the row, so it tracks the text.
    .signin-forgot-password {
        align-items: center;
        color: var(--lp-text-secondary);
        display: flex;
        font-size: 14.5px;
        height: 40px;
        justify-content: center;
        text-decoration: underline;
        text-decoration-color: var(--lp-border-strong);
        text-underline-offset: 3px;
    }

    // The card's footer strip already offers this, so the register form's own
    // skip link would be a second copy of it.
    .lpGetStarted {
        display: none;
    }
}

.lpMobileAnon {
    background: var(--lp-row-hover);
    border-top: 1px solid var(--lp-border);
    color: var(--lp-text);
    font-size: 14.5px;
    padding: 13px $mobileCardPadding;
    text-align: center;
}

.lpMobileAnonLink {
    border-bottom: 1px solid var(--lp-border-strong);
    color: var(--lp-text);
    cursor: pointer;
    font-weight: 600;
}

// --lp-bg and --lp-content-bg are the same value in both themes, so capping
// the whole block rather than an inner wrapper leaves no visible seam.
.lpMobileBody {
    background: var(--lp-content-bg);
    margin: 0 auto;
    max-width: $mobileColumnOuter;
    padding: 26px $mobileGutter 0;
}

// Scoped to the section so it outweighs the global `.lp h2` bottom margin,
// which would otherwise open a 30px hole between the rule and the first step.
.lpMobileBody .lpMobileSectionLabel {
    border-bottom: 1px solid var(--lp-border);
    color: var(--lp-text-secondary);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin: 0;
    padding-bottom: 14px;
    text-transform: uppercase;
}

.lpMobileSteps {
    display: flex;
    flex-direction: column;
    gap: 13px;
    list-style: none;
    margin: 0;
    padding: 16px 0 22px;

    li {
        color: var(--lp-text);
        display: flex;
        font-size: 15.5px;
        gap: 11px;
    }
}

// Cut off at the bottom on purpose: it should read as the app continuing
// past the crop, not as a small framed picture.
.lpMobileShot {
    border: 1px solid var(--lp-border);
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    height: 190px;
    overflow: hidden;

    img {
        display: block;
        // The asset is a full desktop capture. Showing the list pane enlarged
        // keeps it legible at phone width, where the whole window scaled down
        // would not be; the offset crops the app's dark sidebar off the left.
        // Percentages hold the same crop across the range this layout covers.
        margin-left: -43%;
        max-width: none;
        width: 143%;
    }
}

// This page ends in its footer instead of floating one over the photo, so the
// shared footer gets a tint and a rule here. The tint stays full-bleed; only
// its contents line up with the column above. Both classes, to outrank
// .lpSiteFooter's own gap and type size whichever order the bundle emits them.
.lpSiteFooter.lpMobileFooter {
    align-items: center;
    background: var(--lp-row-hover);
    border-top: 1px solid var(--lp-border);
    // Body size rather than the 12px the footer uses inside the app: everything
    // else on this page is set larger, and 12px reads as fine print next to it.
    font-size: 13px;
    gap: 14px;
    line-height: 1.5;
    padding: 20px $mobileGutter 26px;

    > * {
        max-width: $mobileColumn;
        width: 100%;
    }
}

// Footer links read as underlined text rather than blue: at this size a row of
// blue would outweigh the card above it, which is the only thing on the page
// that should be asking to be tapped.
.lpMobileFooter a.lpHref {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--lp-border-strong);
    text-underline-offset: 3px;
}
</style>
