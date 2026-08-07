<template>
    <div id="lp-moderation">
        <h1>Admin panel</h1>

        <form @submit.prevent="searchUsers">
            <input v-model="searchQuery" type="text" placeholder="Search for a user...">
            <button>Search</button>
        </form>
        <ul v-if="resultsLoaded" class="lp-moderation-search-results">
            <li v-for="result in searchResults" :key="result.username" @click="setUser(result)">
                <lp-user-identity :user="result" :query="matchedQuery" />
            </li>
        </ul>

        <div v-if="userToInspect" class="lp-moderation-user-to-inspect">
            <h2>{{ userToInspect.username }}</h2>
            <dl class="lp-moderation-facts">
                <div>
                    <dt>Last seen</dt>
                    <dd :title="absolute(userToInspect.lastSeen)">
                        {{ relative(userToInspect.lastSeen) }}
                    </dd>
                </div>
                <div>
                    <dt>Registered</dt>
                    <dd :title="absolute(userToInspect.registered)">
                        {{ relative(userToInspect.registered) }}
                    </dd>
                </div>
                <div>
                    <dt>Lists</dt>
                    <dd>{{ userToInspect.lists }}</dd>
                </div>
                <div>
                    <dt>Saves</dt>
                    <dd title="sync_token — increments on every save">
                        {{ userToInspect.syncToken }}
                    </dd>
                </div>
            </dl>
            <section>
                <button @click="clearSession(userToInspect)">
                    Clear session
                </button>
                <button @click="resetPassword(userToInspect)">
                    Create password reset link
                </button>
                <template v-if="resetUrl">
                    <p class="lp-moderation-reset-url">
                        <strong>Reset link:</strong> <code>{{ resetUrl }}</code>
                        <br>
                        Send this to the user. It expires in one hour, works once, and
                        leaves their current password working until they use it.
                    </p>
                </template>
            </section>
            <section>
                <p class="lp-moderation-editing">
                    Editing the library of
                    <lp-user-identity :user="userToInspect" :query="matchedQuery" />
                </p>
                <textarea id="lp-moderation-user-library-json" v-model="editableLibrary" />
            </section>
        </div>
    </div>
</template>

<script>
import { h } from 'vue';
import { fetchJson } from '../utils/utils.js';

// Split a value around the search text so the matching run can be marked.
// Segments rather than v-html: usernames and emails are user-supplied.
function markMatches(value, query) {
    const text = String(value ?? '');
    const needle = String(query ?? '').toLowerCase();
    if (!needle) return [text];

    const haystack = text.toLowerCase();
    const parts = [];
    let cursor = 0;
    let index = haystack.indexOf(needle);
    while (index !== -1) {
        if (index > cursor) parts.push(text.slice(cursor, index));
        parts.push(h('mark', text.slice(index, index + needle.length)));
        cursor = index + needle.length;
        index = haystack.indexOf(needle, cursor);
    }
    parts.push(text.slice(cursor));
    return parts;
}

// Which of the two a search hit isn't obvious from the username alone, so both
// fields show, both marked.
const LpUserIdentity = {
    props: {
        user: { type: Object, required: true },
        query: { type: String, default: "" },
    },
    render() {
        return h('span', { class: 'lp-moderation-identity' }, [
            h('span', { class: 'lp-moderation-username' }, markMatches(this.user.username, this.query)),
            h('span', { class: 'lp-moderation-email' }, markMatches(this.user.email, this.query)),
        ]);
    },
};

export default {
    name: 'Admin',
    components: {
        LpUserIdentity,
    },
    data() {
        return {
            searchQuery: "",
            matchedQuery: "",
            searchResults: null,
            userToInspect: null,
            editableLibrary: null,
            resetUrl: null,
        };
    },
    computed: {
        resultsLoaded() {
            return !!this.searchResults;
        }
    },
    beforeMount() {
        // eslint-disable-next-line no-constant-condition
        if (false) {
            this.$router.push('/welcome');
        }
    },
    methods: {
        // Intl rather than a date library — this is the only place that needs it.
        relative(value) {
            const date = value ? new Date(value) : null;
            if (!date || Number.isNaN(date.getTime())) return 'never';

            const seconds = (date.getTime() - Date.now()) / 1000;
            const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
            const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
            for (const [unit, size] of units) {
                if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
            }
            return format.format(Math.round(seconds), 'second');
        },
        absolute(value) {
            const date = value ? new Date(value) : null;
            return !date || Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
        },
        searchUsers() {
            // The term the results were fetched with, not the live input, so
            // typing a new search doesn't re-mark the results on screen.
            const query = this.searchQuery.trim();
            fetchJson(`/moderation/search?q=${this.searchQuery}`, {
                method: 'GET',
                credentials: 'same-origin',
            })
                .then((response) => {
                    this.searchResults = response.results;
                    this.matchedQuery = query;
                })
                .catch((err) => {
                    console.log(err);
                });
        },
        setUser(user) {
            this.userToInspect = user;
            this.editableLibrary = JSON.stringify(this.userToInspect.library);
            this.resetUrl = null;
        },
        clearSession(user) {
            fetchJson(`/moderation/clear-session`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({username: user.username}),
            })
                .then((_response) => {
                    console.log("clear session success");
                })
                .catch((err) => {
                    console.log(err);
                });
        },
        resetPassword(user) {
            fetchJson(`/moderation/reset-password`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({username: user.username}),
            })
                .then((response) => {
                    this.resetUrl = response.resetUrl;
                })
                .catch((err) => {
                    console.log(err);
                });
        }
    },
};
</script>

<style lang="scss">
@import "../css/_globals";


#lp-moderation {
    display: grid;
    grid-template-columns: 20em auto;
    padding: 0 2em;

    h1, & > form {
        grid-column: 1 / 3;
    }

    .lp-moderation-search-results {
        grid-column: 1;
        list-style: none;
        padding: 0;

        li {
            cursor: pointer;
            padding: 0.3em 0.4em;

            &:hover {
                background: var(--lp-row-hover);
            }
        }
    }

    .lp-moderation-user-to-inspect {
        grid-column: 2;
    }

    .lp-moderation-username,
    .lp-moderation-email {
        display: block;
        overflow-wrap: anywhere;
    }

    .lp-moderation-email {
        color: var(--lp-text-secondary);
        font-size: 0.85em;
    }

    // One line here, where the identity trails a label rather than heading a row.
    .lp-moderation-editing {
        .lp-moderation-username,
        .lp-moderation-email {
            display: inline;
        }

        .lp-moderation-email::before {
            content: " · ";
        }
    }

    .lp-moderation-facts {
        display: flex;
        flex-wrap: wrap;
        gap: 0 2em;
        margin: 0 0 1em;

        dt {
            color: var(--lp-text-secondary);
            font-size: 0.8em;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        dd {
            margin: 0;
        }
    }

    mark {
        background: var(--lp-hover-bg);
        color: inherit;
    }
}

#lp-moderation-user-library-json {
    height: 20em;
    width: 100%;
}
</style>
