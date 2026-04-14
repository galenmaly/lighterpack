<template>
    <div id="lp-moderation">
        <h1>Admin panel</h1>

        <form @submit.prevent="searchUsers">
            <input v-model="searchQuery" type="text" placeholder="Search for a user...">
            <button>Search</button>
        </form>
        <ul v-if="resultsLoaded" class="lp-moderation-search-results">
            <li v-for="result in searchResults" :key="result.username" @click="setUser(result)">
                {{ result.username }}
            </li>
        </ul>

        <div v-if="userToInspect" class="lp-moderation-user-to-inspect">
            <h2>{{ userToInspect.username }}</h2>
            <section>
                <button @click="clearSession(userToInspect)">
                    Clear session
                </button>
                <button @click="resetPassword(userToInspect)">
                    Reset password
                </button>
                <template v-if="newPassword">
                    <strong>New Password:</strong> {{ newPassword }}
                </template>
            </section>
            <section>
                <textarea id="lp-moderation-user-library-json" v-model="editableLibrary" />
            </section>
        </div>
    </div>
</template>

<script>
import { fetchJson } from '../utils/utils.js';

export default {
    name: 'Admin',
    components: {
    },
    data() {
        return {
            searchQuery: "",
            searchResults: null,
            userToInspect: null,
            editableLibrary: null,
            newPassword: null,
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
        searchUsers() {
            fetchJson(`/moderation/search?q=${this.searchQuery}`, {
                method: 'GET',
                credentials: 'same-origin',
            })
                .then((response) => {
                    this.searchResults = response.results;
                })
                .catch((err) => {
                    console.log(err);
                });
        },
        setUser(user) {
            this.userToInspect = user;
            this.editableLibrary = JSON.stringify(this.userToInspect.library);
            this.newPassword = null;
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
                    this.newPassword = response.newPassword;
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
    grid-template-columns: 15em auto;
    padding: 0 2em;

    h1, & > form {
        grid-column: 1 / 3;
    }

    .lp-moderation-search-results {
        grid-column: 1;
    }

    .lp-moderation-user-to-inspect {
        grid-column: 2;
    }
}

#lp-moderation-user-library-json {
    height: 20em;
    width: 100%;
}
</style>
