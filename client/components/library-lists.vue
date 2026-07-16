<template>
    <section id="listContainer">
        <div class="lpSidebarSectionHeader listContainerHeader">
            <span class="lpSectionLabel">Lists · {{ library.lists.length }}</span>
            <PopoverHover id="addListFlyout">
                <template #target>
                    <span><a class="lpSidebarNew" data-testid="new-list" @click="newList">+ New</a></span>
                </template>
                <template #content>
                    <div>
                        <a class="lpAdd" @click="newList"><i class="lpSprite lpSpriteAdd" />Add new list</a>
                        <a class="lpAdd" @click="importCSV"><i class="lpSprite lpSpriteUpload" />Import CSV</a>
                        <a class="lpCopy" @click="copyList"><i class="lpSprite lpSpriteCopy" />Copy a list</a>
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
        max-height: 178px;
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
    padding: 5px 8px 5px 18px;
    position: relative;

    &:hover {
        background: var(--lpd-sidebar-inset);
    }

    &.lpActive {
        background: var(--lpd-sidebar-inset);
        box-shadow: inset 3px 0 0 var(--lpd-active-yellow);
        color: var(--lpd-active-yellow);
        font-weight: 600;

        .lpRemove {
            display: none;
        }
    }

    &.gu-mirror {
        background: var(--lpd-sidebar-inset);
        border: 1px solid var(--lpd-sidebar-border);
        color: var(--lpd-sidebar-text);
    }

    .lpHandle {
        left: 2px;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
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

// The + New flyout opens to the right of the rail so it never covers the
// list rows beneath it (an open popover would swallow their clicks).
#addListFlyout {
    .lpContent {
        left: 100%;
        margin-top: 0;
        top: -8px;
        transform: none;

        &::before {
            display: none;
        }

        &::after {
            display: none;
        }

        a {
            display: block;
            margin-bottom: 5px;

            &:last-child {
                margin-bottom: 0;
            }
        }
    }
}
</style>
