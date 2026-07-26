<template>
    <section id="listContainer">
        <div class="lpSidebarSectionHeader listContainerHeader">
            <span class="lpSectionLabel">Lists · {{ library.lists.length }}</span>
            <PopoverHover id="addListFlyout">
                <template #target>
                    <span><a class="lpSidebarNew" data-testid="new-list" @click="newListFromTarget">+ New</a></span>
                </template>
                <template #content>
                    <div>
                        <a class="lpAdd" data-testid="new-list-blank" @click="newList"><i class="lpSprite lpSpriteAdd" />Add new list</a>
                        <a class="lpCopy" @click="copyList"><i class="lpSprite lpSpriteCopy" />Copy a list</a>
                        <a class="lpAdd" @click="importCSV"><i class="lpSprite lpSpriteUpload" />Import CSV</a>
                    </div>
                </template>
            </PopoverHover>
        </div>
        <div class="lpSidebarListsRegion">
            <ul id="lists" class="lpSidebarScroll">
                <li v-for="list in library.lists" :key="list.id" class="lpLibraryList" :class="{lpActive: (library.defaultListId == list.id)}" @click="setDefaultList(list)">
                    <div class="lpHandle" title="Reorder this list" />
                    <span class="lpLibraryListSwitch lpListName">
                        {{ listName(list) }}
                    </span>
                    <a class="lpRemove" title="Remove this list" @click.stop="removeList(list)"><i class="lpSprite lpSpriteRemove" /></a>
                </li>
            </ul>
        </div>
    </section>
</template>

<script>
import PopoverHover from './popover-hover.vue';

import dragula from 'dragula';
import { getElementIndex } from '../utils/utils.js';

export default {
    name: 'LibraryList',
    components: {
        PopoverHover,
    },
    inject: ['openCopyList', 'openImportCSV', 'initSpeedbump'],
    props: ['list'],
    computed: {
        library() {
            return this.$store.state.library;
        },
    },
    mounted() {
        this.handleListReorder();
    },
    methods: {
        listName(list) {
            return list.name || 'New list';
        },
        setDefaultList(list) {
            this.$store.commit('setDefaultList', list);
        },
        // On a pointer device the flyout is already open on hover, so clicking
        // the target itself is the shortcut that makes a list outright. With no
        // hover, the tap is what opens the menu — creating a list here too
        // would mean picking "Add new list" from it left you with two.
        newListFromTarget() {
            if (window.matchMedia('(hover: hover)').matches) {
                this.newList();
            }
        },
        newList() {
            this.$store.commit('newList');
            // Frictionless naming: drop the cursor straight into the title.
            this.$nextTick(() => {
                const title = document.getElementById('lpListName');
                if (title) title.focus();
            });
        },
        copyList() {
            this.openCopyList();
        },
        importCSV() {
            this.openImportCSV();
        },
        handleListReorder() {
            const $lists = document.getElementById('lists');
            const drake = dragula([$lists], {
                moves(_$el, _$source, $handle, _$sibling) {
                    return $handle.classList.contains('lpHandle');
                },
            });
            drake.on('drag', ($el, _$target, _$source, _$sibling) => {
                this.dragStartIndex = getElementIndex($el);
            });
            drake.on('drop', ($el, _$target, _$source, _$sibling) => {
                this.$store.commit('reorderList', { before: this.dragStartIndex, after: getElementIndex($el) });
                drake.cancel(true);
            });
        },
        removeList(list) {
            const callback = function () {
                this.$store.commit('removeList', list);
            };
            const speedbumpOptions = {
                body: 'Are you sure you want to delete this list? This cannot be undone.',
            };
            this.initSpeedbump(callback, speedbumpOptions);
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

#listContainer {
    flex: 0 0 auto;
}

// Capped at ~7 rows with its own thin scrollbar.
.lpSidebarListsRegion {
    position: relative;

    #lists {
        margin: 0;
        max-height: 280px;
        padding: 0;
    }
}

// The whole row is the switch target — identical to the hover surface.
.lpLibraryList {
    align-items: center;
    cursor: pointer;
    display: flex;
    font-size: 13px;
    list-style: none;
    padding: 6px 8px 6px 20px;
    position: relative;

    &:hover {
        background: var(--lp-sidebar-inset);
    }

    &.lpActive {
        background: var(--lp-sidebar-inset);
        color: var(--lp-active-yellow);
        font-weight: 600;

        .lpRemove {
            display: none;
        }
    }

    &.gu-mirror {
        background: var(--lp-sidebar-inset);
        border: 1px solid var(--lp-sidebar-border);
        color: var(--lp-sidebar-text);
    }

    .lpHandle {
        left: 4px;
        position: absolute;
        transform: translateY(-2px);
    }

    &:hover .lpHandle {
        visibility: visible;
    }

    .lpListName {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &:hover {
            cursor: pointer;
        }
    }

    .lpRemove {
        flex: 0 0 auto;
        margin-bottom: 0;
    }
}

.listContainerHeader .lpPopover .lpTarget {
    padding-bottom: 4px;
}

// The + New flyout drops beneath its target at the top-right of the rail.
// It right-anchors so a menu wider than the "+ New" link still stays within
// the rail, and the top-right corner — nearest the target — is squared off.
#addListFlyout {
    .lpContent {
        border-top-right-radius: 0;
        left: auto;
        right: 0;
        transform: none;

        a {
            display: block;
            margin-bottom: 5px;

            &:last-child {
                margin-bottom: 0;
            }
        }
    }
}

.lpLibraryList:hover .lpRemove {
    visibility: visible;
}

// ============================================================
// Phone layout — list rows in the drawer (#11f)
// ============================================================
@media only screen and (width <= $mobile) {
    // The desktop cap (~7 rows) exists to leave the gear region room in a
    // fixed-height rail. The drawer is full-height, so give the lists more of
    // it and let the region scroll.
    .lpSidebarListsRegion #lists {
        max-height: 45vh;
    }

    .lpLibraryList {
        font-size: 14px;
        padding: 11px 12px 11px 20px;
    }

    // Every reveal-on-hover control is unreachable on a touch screen. The
    // design's answer for deletion is the swipe gesture (#11e), which isn't
    // built yet — until it is, the ✕ stays visible so lists can still be
    // deleted from a phone. It's speedbumped, so a stray tap is recoverable.
    .lpLibraryList .lpRemove {
        visibility: visible;
    }
}
</style>
