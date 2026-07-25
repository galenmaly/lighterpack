import { ref } from 'vue';

// The phone breakpoint, as a reactive flag.
//
// Most of the mobile design is a media query living in each component's own
// style block. Two surfaces aren't reachable that way — the item row (display
// vs. tap-to-edit is a mode switch, not a reflow) and the list summary (the
// collapsed scoreboard strip has no desktop counterpart) — so they swap
// components instead, keyed off this.
//
// Must match $mobile in client/css/_globals.scss.
export const mobileBreakpoint = 720;

const query = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);

// Module-level singleton: one listener for the whole app, however many
// components read it.
export const isMobile = ref(query.matches);

query.addEventListener('change', (evt) => {
    isMobile.value = evt.matches;
});

export default isMobile;
