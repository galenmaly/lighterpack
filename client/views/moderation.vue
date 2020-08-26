<style lang="scss">
@import "../css/_globals";


#lp-moderation {
    padding: 0 2em;
    display: grid;
    grid-template-columns: 15em auto;

    h1, & > form {
        grid-column-start: 1;
        grid-column-end: 3;
    }

    .lp-moderation-search-results {
        grid-column: 1;
    }

    .lp-moderation-user-to-inspect {
        grid-column: 2;
    }
}

#lp-moderation-user-library-json {
    width: 100%;
    height: 20em;
}
</style>

<template>
    <div id="lp-moderation">
        <h1>Admin panel</h1>

        <form @submit.prevent="searchUsers">
            <input v-model="searchQuery" type="text" placeholder="Search for a user..." />
            <button>Search</button>
        </form>
        <ul v-if="resultsLoaded" class="lp-moderation-search-results">
            <li v-for="result in searchResults" @click="setUser(result)" :key="result.username">
                {{result.username}}
            </li>
        </ul>

        <div v-if="userToInspect" class="lp-moderation-user-to-inspect">
            <h2>{{userToInspect.username}}</h2>
            <section>
                <button @click="resetPassword(userToInspect)">Reset password</button>
                <template v-if="newPassword">
                    <strong>New Password:</strong> {{ newPassword }}
                </template>
            </section>
            <section>
                <textarea id="lp-moderation-user-library-json" v-model="editableLibrary"></textarea>
            </section>
        </div>
    </div>
</template>

<script>
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
        if (false) {
            router.push('/welcome');
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
