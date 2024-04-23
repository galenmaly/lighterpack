const dayjs = require('dayjs');
const fs = require('fs');
const es = require('event-stream');
const { EOL } = require('os');
const config = require('config');
const knex = require('knex')({
    client: 'pg',
    connection: config.get('logDatabase')
});
const logs = [];

let maxDate = null;

// Get output from scripts/log-cleanup.js
const files = [].reverse();

let month_buckets = {};
let day_buckets = {};
let hour_buckets = {};

let current_month = null;
let current_day = null;
let current_hour = null;

function concat_buckets(buckets) {
    let metaBucket = [];
    for (pageName in buckets) {
        let bucket = buckets[pageName];
        metaBucket = metaBucket.concat(bucket);
    }
    return metaBucket;
}

function calculate_bucket_stats(bucket) {
    registered_users = [];
    visitors = [];
    lists =  [];

    latencies = [];

    statusCodes = {
        "200": 0,
        "400": 0,
        "500": 0,
        "other": 0
    };

    let impressions = 0;

    for (let i = 0; i < bucket.length; i++) {
        let log = bucket[i];

        if (log["username"]) {
            registered_users.push(log["username"]);
        } else {
            visitors.push(log["remote-addr"] + log["user-agent"]);
        }
        
        if (log["url"].substring(0,3) === "/r/" || log["url"].substring(0,3) === "/e/") {
            let list_id = log["url"].substring(3);           
            lists.push(list_id);
        }

        if (log["status"] === "200") {
            statusCodes["200"] ++;
        } else if (log["status"] === "400") {
            statusCodes["400"] ++;
        } else if (log["status"] === "500") {
            statusCodes["500"] ++;
        } else {
            statusCodes["other"] ++;
        }

        latencies.push(parseFloat(log["response-time"],10));
        impressions++;
    }

    latencies.sort();

    return {
        impressions: bucket.length,
        unique_visitors: new Set(visitors).size,
        unique_registered_users: new Set(registered_users).size,
        unique_list_views: new Set(lists).size,
        p50: latencies[Math.round(latencies.length*0.5)],
        p90: latencies[Math.round(latencies.length*0.9)],
        p95: latencies[Math.round(latencies.length*0.95)],
        p99: latencies[Math.round(latencies.length*0.99)],
        status_200: statusCodes["200"]/impressions,
        status_400: statusCodes["400"]/impressions,
        status_500: statusCodes["500"]/impressions,
        status_other: statusCodes["other"]/impressions,
    };
}

async function insert_buckets(trx, month, day, hour, buckets) {
    if (!Object.keys(buckets).length) {
        return;
    }

    let bucketIdentification = {};
    
    if (hour) {
        bucketIdentification["hour_of_day"] = parseInt(hour.substring(11),10);
    }
    if (day) {
        bucketIdentification["day_of_week"] = parseInt(dayjs(day).format("d"),10);
        bucketIdentification["bucket_date"] = dayjs(day).toDate();
    }
    bucketIdentification["bucket_month"] = dayjs(month).startOf('month').toDate();

    for (pageName in buckets) {
        let bucket = buckets[pageName];
        let bucketStats = calculate_bucket_stats(bucket);

        Object.assign(bucketStats, bucketIdentification);
        bucketStats["page_name"] = pageName;

        await knex('bucket').transacting(trx).insert(bucketStats);
    }

    let metaBucket = concat_buckets(buckets);
    let metaBucketStats = calculate_bucket_stats(metaBucket);
    Object.assign(metaBucketStats, bucketIdentification);

    await knex('bucket').transacting(trx).insert(metaBucketStats);
    
}

function getPageName(log) {
    if (!log["url"]) {
        return;
    }

    if (log["url"].substring(0,3) === "/r/") {
        return "list";
    }
    if (log["url"].substring(0,3) === "/e/") {
        return "embed";
    }
    if (log["url"] === "/saveLibrary/") {
        return "save_library";
    }
    if (log["url"] === "/" || log["url"] === "/welcome") {
        return "home";
    }
    if (log["url"] === "/signin") {
        return "signin";
    }
    if (log["url"] === "/register") {
        return "register";
    }
    if (log["url"] === "/forgotUsername") {
        return "forgot_username";
    }
    if (log["url"] === "/forgotPassword") {
        return "forgot_password";
    }
    if (log["url"] === "/account") {
        return "account";
    }
    if (log["url"] === "/imageUpload") {
        return "image_upload";
    }
    if (log["url"] === "/delete-account") {
        return "delete_account";
    }
    if (log["url"] === "/externalId") {
        return "external_id";
    }
}

async function importFile(trx, fileName) {
    // Store in DB

    return new Promise((resolve, reject) => {   
        console.log("starting to read...")
        let lineNumber = 0;
        var s = fs.createReadStream(fileName)
            .pipe(es.split())
            .pipe(es.mapSync(async function(line){
                s.pause();
    
                lineNumber += 1;
                if (lineNumber % 1000 === 0) {
                    console.log(lineNumber);
                }
                let log;
                try {
                    log = JSON.parse(line)
                } catch (err) {
                    //noop
                    console.log("error on line:" + lineNumber)
                    //console.log(line);
                    //console.log(err);
                    s.resume();
                    return;
                }

                let pageName = getPageName(log);
                if (pageName) {
                    const lineDateTime = dayjs(log["timestamp"]).toDate();

                    if (!maxDate) {
                        maxDate = lineDateTime;
                        console.log("set max date")
                    }
                    if (lineDateTime < maxDate) {
                        s.resume();
                        return;
                    }
                    maxDate = lineDateTime;

                    const hour = dayjs(log["timestamp"]).format("YYYY-MM-DD-HH");
                    if (hour !== current_hour) {
                        await insert_buckets(trx, current_month, current_day, current_hour, hour_buckets);
                        hour_buckets = {};
                        current_hour = hour;
                    }
                    if (!hour_buckets[pageName]) {
                        hour_buckets[pageName] = [];
                    }
                    hour_buckets[pageName].push(log);
    
                    const day = dayjs(log["timestamp"]).format("YYYY-MM-DD");
                    if (day !== current_day) {
                        await insert_buckets(trx, current_month, current_day, null, day_buckets);
                        day_buckets = {};
                        current_day = day;
                    }
                    if (!day_buckets[pageName]) {
                        day_buckets[pageName] = [];
                    }
                    day_buckets[pageName].push(log);
    
                    const month = dayjs(log["timestamp"]).format("YYYY-MM");
                    if (month !== current_month) {
                        await insert_buckets(trx, current_month, null, null, month_buckets);
                        month_buckets = {};
                        current_month = month
                    }
                    if (!month_buckets[pageName]) {
                        month_buckets[pageName] = [];
                    }
                    month_buckets[pageName].push(log);
                }
    
                s.resume();
            })
            .on('error', function(err){
                console.log('Error while reading file.', err);
                reject(err);
            })
            .on('end', function(){
                console.log('Read entire file.')
                resolve();
            })
        );
    });
}

async function importFiles(files) {
    knex.transaction(async function(trx) {
        console.log("Starting transaction");
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            await importFile(trx, file.fileName);
        }
        trx.commit();
    })
    .then(() => {
        console.log("transaction complete");
    })
}

importFiles(files)

