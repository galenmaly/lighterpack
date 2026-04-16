<template>
    <section id="listContainer">
        <div class="listContainerHeader">
            <h2>Lists</h2>
            <PopoverHover id="addListFlyout">
                <template #target>
                    <span><a class="lpAdd" @click="newList"><i class="lpSprite lpSpriteAdd" />Add new list</a></span>
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
        <ul id="lists">
            <li v-for="list in library.lists" :key="list.id" class="lpLibraryList" :class="{lpActive: (library.defaultListId == list.id)}">
                <div class="lpHandle" title="Reorder this item" />
                <span class="lpLibraryListSwitch lpListName" @click="setDefaultList(list)">
                    {{ listName(list) }}
                </span>
                <a class="lpRemove" title="Remove this list" @click="removeList(list)"><i class="lpSprite lpSpriteRemove" /></a>
            </li>
        </ul>
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

    #lists {
        max-height: 25vh;
    }
}

.lpLibraryList {
    border-top: 1px dotted var(--lp-sidebar-item-border);
    display: flex;
    list-style: none;
    margin: 0 10px;
    overflow-y: auto;
    padding: 6px 0;
    position: relative;

    &:first-child {
        border-top: none;
        padding-top: 10px;
    }

    &:last-child {
        border-bottom: none;
    }

    &.lpActive {
        color: $yellow1;
        font-weight: bold;

        .lpRemove {
            display: none;
        }
    }

    &.gu-mirror {
        background: var(--lp-sidebar-list-bg);
        border: 1px solid var(--lp-sidebar-item-border);
        color: var(--lp-sidebar-text);
    }

    .lpHandle {
        flex: 0 0 12px;
        height: 18px;
        margin-right: 5px;
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
            text-decoration: underline;
        }
    }

    .lpRemove {
        flex: 0 0 8px;
        margin-bottom: 0;
    }
}

.listContainerHeader {
    display: flex;
    justify-content: space-between;
}

#addListFlyout {
    .lpContent a {
        display: block;
        margin-bottom: 5px;

        &:last-child {
            margin-bottom: 0;
        }
    }
}
</style>
