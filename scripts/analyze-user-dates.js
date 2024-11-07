//Analyze the output of find-user-dates for a sanity check that it has good input data and data processing

const fs = require('fs');
let firstSeenBuckets = {};

if (process.argv.length !== 3) {
    console.error('Expected log directory as argument');
    process.exit(1);
}

function sortBuckets(dateBuckets) {
    const sortedDateBuckets = {};
    const keys = Object.keys(dateBuckets);
    console.log(keys)
    keys.sort();

    for (let key of keys) {
        sortedDateBuckets[key] = dateBuckets[key];
    }
    return sortedDateBuckets;
}

async function importFiles(fileName) {
    let registeredBuckets = {}
    console.log("starting to read...")
    const userDatesRaw = fs.readFileSync(fileName)
    const userDates = JSON.parse(userDatesRaw);
    
    for (username in userDates) {
        let user = userDates[username];
        if (user.registered) {
            const registeredBucket = user.registered.substring(0,7);
            if (!registeredBuckets[registeredBucket]) {
                registeredBuckets[registeredBucket] = 0;
            }
            registeredBuckets[registeredBucket] ++;
        } else {
            const firstSeenBucket = user.firstSeen.substring(0,7);
            if (!firstSeenBuckets[firstSeenBucket]) {
                firstSeenBuckets[firstSeenBucket] = 0;
            }
            firstSeenBuckets[firstSeenBucket] ++;
            if (firstSeenBucket === "2022-04") {
                console.log(username);
            }
        }
    }

    const sortedRegisteredBuckets = sortBuckets(registeredBuckets);
    const sortedFirstSeenBuckets = sortBuckets(firstSeenBuckets);

    console.log("complete");
    console.log(sortedRegisteredBuckets);
    console.log("first seen:")
    console.log(sortedFirstSeenBuckets);
}

importFiles(process.argv[2])
