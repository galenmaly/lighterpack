<template>
    <div class="lpListDescriptionContainer">
        <textarea
            v-if="editing"
            ref="textarea"
            :value="draft"
            class="lpListDescriptionInput"
            data-testid="list-description-input"
            placeholder="Add a summary..."
            @input="onInput"
            @blur="finishEditing"
            @keydown.esc="$event.target.blur()"
        />
        <!-- eslint-disable-next-line vue/no-v-html -- output is sanitized by the shared marked renderer -->
        <div v-else-if="hasDescription" class="lpListDescriptionRendered" data-testid="list-description-rendered" @click="edit" v-html="renderedDescription" />
        <div v-else class="lpListDescriptionEmpty" data-testid="list-description-empty" role="button" tabindex="0" @click="edit" @keydown.enter.prevent="edit">
            Add a summary...
        </div>
        <p v-if="editing" class="lpListDescriptionHint">
            <a href="https://guides.github.com/features/mastering-markdown/" target="_blank" class="lpHref" @mousedown.prevent>Markdown</a> supported
        </p>
    </div>
</template>

<script>
import { marked } from '../utils/markdown.js';

export default {
    name: 'ListDescription',
    props: ['list'],
    data() {
        return {
            editing: false,
            draft: '',
        };
    },
    computed: {
        hasDescription() {
            return Boolean(this.list.description && this.list.description.trim());
        },
        renderedDescription() {
            return marked(this.list.description || '');
        },
    },
    methods: {
        edit(evt) {
            // Links open in a new tab, so a click on one shouldn't also
            // flip the summary into edit mode.
            if (evt && evt.target.closest('a')) {
                return;
            }
            this.draft = this.list.description || '';
            this.editing = true;
            this.$nextTick(() => {
                const $textarea = this.$refs.textarea;
                $textarea.focus();
                $textarea.setSelectionRange($textarea.value.length, $textarea.value.length);
                this.resize();
            });
        },
        finishEditing() {
            this.editing = false;
        },
        onInput(evt) {
            this.draft = evt.target.value;
            this.$store.commit('updateListDescription', { id: this.list.id, description: this.draft });
            this.resize();
        },
        resize() {
            const $textarea = this.$refs.textarea;
            if (!$textarea) {
                return;
            }
            // scrollHeight excludes the (transparent) borders, so add them back
            // to keep the border-box height from clipping a pixel.
            $textarea.style.height = 'auto';
            $textarea.style.height = `${$textarea.scrollHeight + 2}px`;
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

.lpListDescriptionContainer {
    margin: 0 0 25px;
}

// All three states share the same border-box metrics (1px border + 12px
// padding) so the text doesn't shift as the component changes state.
.lpListDescriptionEmpty,
.lpListDescriptionRendered,
.lpListDescriptionInput {
    border: 1px solid transparent;
    border-radius: 7px;
    line-height: 1.5;
    padding: 12px;
    width: 100%;
}

.lpListDescriptionEmpty {
    border-color: var(--lp-border);
    color: var(--lp-text-secondary);
    cursor: text;
}

.lpListDescriptionRendered {
    cursor: text;

    &:hover {
        border-color: var(--lp-border);
    }

    > :first-child {
        margin-top: 0;
    }

    > :last-child {
        margin-bottom: 0;
    }
}

.lpListDescriptionInput {
    border-color: var(--lp-border);
    display: block;
    min-height: 72px;
    outline: none;
    overflow: hidden;
    resize: none;

    &::placeholder {
        color: var(--lp-text-secondary);
    }
}

.lpListDescriptionHint {
    color: var(--lp-text-secondary);
    font-size: 11.5px;
    margin: 6px 2px 0;
}

// The list body loses its side padding on a phone so row dividers can run full
// bleed, which left this box flush to both edges. It also sits directly under
// the summary strip with no air above it, and the desktop's 25px below is more
// gap than the first category header needs.
@media only screen and (width <= $mobile) {
    .lpListDescriptionContainer {
        margin: 14px 14px 12px;
    }
}
</style>
