<template>
    <div id="sidebarAccount">
        <PopoverHover v-if="isSignedIn" id="accountPopover">
            <template #target>
                <span class="lpAccountRow" data-testid="account-menu">
                    <span class="lpUsername username">{{ username }}</span>
                    <i class="lpSprite lpExpand" />
                </span>
            </template>
            <template #content>
                <div>
                    <a class="lpHref accountSettings" @click="showAccount">Account Settings</a><br>
                    <a class="lpHref" @click="showHelp">Help</a><br>
                    <a class="lpHref signout" @click="signout">Sign Out</a>
                </div>
            </template>
        </PopoverHover>
        <div v-else class="lpAccountRow signInRegisterButtons">
            <router-link to="/signin" class="lpHref">
                Sign In
            </router-link>
            <span class="lpAccountSep">·</span>
            <router-link to="/register" class="lpHref">
                Register
            </router-link>
        </div>
    </div>
</template>

<script>
import PopoverHover from './popover-hover.vue';

export default {
    name: 'AccountDropdown',
    components: {
        PopoverHover,
    },
    inject: ['openAccount', 'openHelp'],
    computed: {
        library() {
            return this.$store.state.library;
        },
        isSignedIn() {
            return this.$store.state.loggedIn;
        },
        username() {
            return this.$store.state.loggedIn;
        },
    },
    methods: {
        showAccount() {
            this.openAccount();
        },
        showHelp() {
            this.openHelp();
        },
        async signout() {
            await this.$store.dispatch('signout');
            this.$router.push('/signin');
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

// Hairline-topped account footer pinned to the bottom of the sidebar.
#sidebarAccount {
    border-top: 1px solid var(--lp-sidebar-border);
    flex: 0 0 auto;

    .lpAccountRow {
        align-items: center;
        cursor: default;
        display: flex;
        gap: 9px;
        padding: 11px 18px;
    }

    .lpUsername {
        color: var(--lp-sidebar-text);
        flex: 1 1 auto;
        font-size: 12px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .lpExpand {
        opacity: 0.6;
    }

    .signInRegisterButtons {
        font-size: 12px;

        .lpAccountSep {
            color: var(--lp-sidebar-muted);
        }

        .lpHref {
            color: var(--lp-sidebar-link);
        }
    }

    // The popover opens upward from the bottom of the viewport.
    .lpPopover {
        .lpTarget {
            display: block;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        .lpContent {
            bottom: calc(100% + 8px);
            left: 10px;
            margin-top: 0;
            top: auto;
            transform: none;

            &::before {
                bottom: -10px;
                left: 30px;
                top: auto;
            }

            &::after {
                bottom: 0;
                top: auto;
            }
        }
    }
}
</style>
