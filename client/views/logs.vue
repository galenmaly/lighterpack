<style lang="scss">
@import "../css/_globals";


#lp-logs {
    padding: 2rem;

    .table-wrapper {
        height: 400px;
        overflow-y: auto;
    }
    table th, td {
        padding: 2px 5px;
        text-align: right;
    }
    thead th {
        position: sticky;
        top: 0;
        background: #f7f7f7;
    }
}

</style>

<template>
    <div id="lp-logs">
        <h1>Logs</h1>

        <select v-model="selectedPageName" @change="loadLogs()">
            <option value="">All</option>"
            <option v-for="pageName in pageNames" :value="pageName">{{ pageName }}</option>
        </select>

        <select v-model="selectedInterval" @change="loadLogs()">
            <option v-for="interval in intervals" :value="interval">{{ interval }}</option>
        </select>

        <apexchart type="line" height="600" :options="options" :series="daySeries"></apexchart>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Impressions</th>
                        <th>Unique Visitors</th>
                        <th>Unique Registered Users</th>
                        <th>Unique List Views</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="day in dayLogs">
                        <td>{{ day.bucket_date || day.bucket_month }}</td>
                        <td>{{ day.impressions }}</td>
                        <td>{{ day.unique_visitors }}</td>
                        <td>{{ day.unique_registered_users }}</td>
                        <td>{{ day.unique_list_views }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
export default {
    name: 'Logs',
    components: {
    },
    data() {
        return {
            intervals: ["day", "month"],
            selectedInterval: "day",
            pageNames: ["list", "embed", "save_library", "home", "signin", "register", "forgot_username" ,"forgot_password", "account", "image_upload", "delete_account", "external_id"],
            selectedPageName: "",
            dayLogs: [],
            monthLogs: [],
            options: {
                chart: {
                id: 'vuechart-example'
                },
            },
        };
    },
    computed: {
        daySeries() {
            let intervalKey = "bucket_date";
            if (this.selectedInterval === "month") {
                intervalKey = "bucket_month";
            }

            return [{
                name: 'impressions',
                data: this.dayLogs.map((dayLog) => {
                    return {x: dayLog[intervalKey].substring(0,10), y: dayLog.impressions};
                })
            },
            {
                name: 'unique visitors',
                data: this.dayLogs.map((dayLog) => {
                    return {x: dayLog[intervalKey].substring(0,10), y: dayLog.unique_visitors};
                })
            },
            {
                name: 'unique registered users',
                data: this.dayLogs.map((dayLog) => {
                    return {x: dayLog[intervalKey].substring(0,10), y: dayLog.unique_registered_users};
                })
            },
            {
                name: 'unique list views',
                data: this.dayLogs.map((dayLog) => {
                    return {x: dayLog[intervalKey].substring(0,10), y: dayLog.unique_list_views};
                })
            }];
        }
    },
    beforeMount() {
        this.loadLogs();
    },
    methods: {
        loadLogs() {
            fetchJson(`/moderation/logs?interval=${this.selectedInterval}&page_name=${this.selectedPageName}`, {
                method: 'GET',
                credentials: 'same-origin',
            })
            .then((response) => {
                this.dayLogs = response.results;
            })
            .catch((err) => {
                console.log(err);
            });
        },
    },
};
</script>
