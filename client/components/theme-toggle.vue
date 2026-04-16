<template>
    <button
        class="lpThemeToggle headerItem"
        :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggle"
    >
        <svg v-if="isDark" class="lpThemeIcon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="3" />
            <line x1="8" y1="1" x2="8" y2="2.5" />
            <line x1="8" y1="13.5" x2="8" y2="15" />
            <line x1="1" y1="8" x2="2.5" y2="8" />
            <line x1="13.5" y1="8" x2="15" y2="8" />
            <line x1="3.05" y1="3.05" x2="4.1" y2="4.1" />
            <line x1="11.9" y1="11.9" x2="12.95" y2="12.95" />
            <line x1="3.05" y1="12.95" x2="4.1" y2="11.9" />
            <line x1="11.9" y1="4.1" x2="12.95" y2="3.05" />
        </svg>
        <svg v-else class="lpThemeIcon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M6 1.5a6.5 6.5 0 1 0 8.5 8.5A5 5 0 0 1 6 1.5z" />
        </svg>
    </button>
</template>

<script>
import { toggleTheme } from '../utils/theme.js';

export default {
    name: 'ThemeToggle',
    data() {
        return {
            isDark: document.documentElement.getAttribute('data-theme') === 'dark',
        };
    },
    methods: {
        toggle() {
            toggleTheme();
            this.isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

.lpThemeToggle {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
    padding: 17px 10px;

    &:hover {
        opacity: 1;
    }

    &:focus {
        outline: none;
    }
}

.lpThemeIcon {
    display: block;
    position: relative;
    top: 1px;
}
</style>
