<style lang="scss">

#importValidate {
    height: 500px;
    overflow-y: scroll;
    width: 650px;

    .lpButton {
        margin-bottom: 30px;
    }
}

</style>

<template>
    <div id="importCSV">
        <modal :shown="shown" @hide="shown = false" id="importValidate">
            <h2>Confirm your import</h2>
            <div id="importData">
                <ul class="lpTable lpDataTable">
                    <li class="lpRow lpHeader">
                        <span class="lpCell">Item Name</span>
                        <span class="lpCell">Category</span>
                        <span class="lpCell">Description</span>
                        <span class="lpCell">Qty</span>
                        <span class="lpCell">Weight</span>
                        <span class="lpCell">Unit</span>
                    </li>
                    <li v-for="row in importData.data" class="lpRow">
                        <span class="lpCell">{{row.name}}</span>
                        <span class="lpCell">{{row.category}}</span>
                        <span class="lpCell">{{row.description}}</span>
                        <span class="lpCell">{{row.qty}}</span>
                        <span class="lpCell">{{row.weight}}</span>
                        <span class="lpCell">{{row.unit}}</span>
                    </li>
                </ul>
            </div>
            <a @click="importList" class="lpButton" id="importConfirm">Import List</a>
            <a @click="shown = false" class="lpButton close">Cancel Import</a>
        </modal>
        <form id="csvUpload">
            <input type="file" name="csv" id="csv" />
        </form>
    </div>
</template>

<script>
import modal from "./modal.vue";

export default {
    name: "import-csv",
    components: {
        modal
    },
    data: function() {
        return {
            csvInput: false,
            listId: false,
            importData: {},
            fullUnitToUnit: {ounce: "oz", ounces: "oz", oz: "oz", pound: "lb", pounds: "lb", lb: "lb", lbs: "lb", gram: "g", grams: "g", g: "g", kilogram: "kg", kilograms: "kg", kg: "kg", kgs: "kg"},
            shown: false
        }
    },
    computed: {
        library: function() {
            return this.$store.state.library;
        }
    },
    methods: {
        importCSV: function(evt) {
            var file = evt.target.files[0];
            var name = file.name;
            var size = file.size;
            var type = file.type;

            if (file.name.length < 1) {
                return;
            }
            else if(file.size > 1000000) {
                alert("File is too big");
                return;
            }
            else if(name.substring(name.length-4).toLowerCase() != '.csv' ) {
                alert("Please select a CSV.");
                return;
            }
            var reader = new FileReader();

            reader.onload = ((theFile) => {
                this.validateImport(theFile.target.result, file.name.substring(0, file.name.length-4).replace(/\_/g, " "));
            });

            reader.readAsText(file);
        },
        CSVToArray: function(strData) {
            var strDelimiter = ",",
                arrData = [[]],
                arrMatches = null;


            var objPattern = new RegExp(
                (
                    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
                    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
                    "([^\"\\" + strDelimiter + "\\r\\n]*))"
                ), "gi");

            while (arrMatches = objPattern.exec( strData )){
                var strMatchedDelimiter = arrMatches[ 1 ];
                if ( strMatchedDelimiter.length && (strMatchedDelimiter != strDelimiter) ) {
                    arrData.push([]);
                }

                if (arrMatches[2]){
                    var strMatchedValue = arrMatches[2].replace(new RegExp( "\"\"", "g" ), "\"");
                } else {
                    var strMatchedValue = arrMatches[3];
                }

                arrData[arrData.length - 1].push( strMatchedValue );
            }

            return arrData ;
        },
        validateImport: function(input, name) {
            var csv = this.CSVToArray(input);
            this.importData = {data: [], name: name};

            for (var i in csv) {
                var row = csv[i];
                if (row.length < 6) continue;
                if (row[0].toLowerCase() == "item name") continue;
                if (isNaN(parseInt(row[3]))) continue;
                if (isNaN(parseInt(row[4]))) continue;
                if (typeof this.fullUnitToUnit[row[5]] == "undefined") continue;

                this.importData.data.push({
                    name: row[0],
                    category: row[1],
                    description: row[2],
                    qty: parseFloat(row[3]),
                    weight: parseFloat(row[4]),
                    unit: this.fullUnitToUnit[row[5]]
                });
            }

            if (!this.importData.data.length) {
                alert("Unable to load spreadsheet - please verify the format.");
            } else {
                this.shown = true;
            }
        },
        importList: function() {
            this.$store.commit("importCSV", this.importData);
            this.shown = false;
        }

    },
    mounted: function() {
        this.csvInput = document.getElementById("csv");
        this.csvInput.onchange = this.importCSV;

        bus.$on("importCSV", () => {
            this.csvInput.click();
        });
    }
}
</script>