// Walk request logs to determine each user's registration date and last-seen
// date, then fill gaps from database exports. Output feeds mongo-to-postgres
// (registration backfill) and the duplicate-fixer scripts (email gating).
//
// Handles every log era (early malformed lines, plaintext, winston JSON) and
// reads .gz files transparently. --seed starts from a previous output file so
// only newer logs need processing:
//
//   node scripts/find-user-dates.cjs <logDir> <dbDumpDir> <output.json> [--seed old-user-dates.json]
//
// Registration dates only ever move earlier: a seeded date is never
// overwritten by later evidence (e.g. a failed re-registration attempt).

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');

const argv = process.argv.slice(2);
const seedIdx = argv.indexOf('--seed');
const seedPath = seedIdx === -1 ? null : argv[seedIdx + 1];
if (seedIdx !== -1) argv.splice(seedIdx, 2);
const args = argv.filter((a) => !a.startsWith('--'));
if (args.length !== 3 || (seedIdx !== -1 && !seedPath)) {
    console.error('Usage: node scripts/find-user-dates.cjs <logDir> <dbDumpDir> <output.json> [--seed old-user-dates.json]');
    process.exit(2);
}
const [logDirectory, databaseDirectory, outputFileName] = args;

const usernames = {};
const earlyUsers = []; // manually populate

let num2013Registration = 0;
let num2014Registration = 0;
let numFallbackRegistration = 0;
let numDBRegistration = 0;

// probably not comprehensive
const badUsernameSubstrings = [
    'Bad password for:',
    'sent username message for user:',
    'Attempting to send username to',
    'Attempting to send new password to',
    'Forgot password for unknown user',
    'password changed for user:',
    'Forgot password lookup error for:',
    'Bad usersfor:',
    'Bad users for:',
    'Error on authenticateUser for:',
    'Forgot email lookup error for:',
    'Error on authenticate user',
    'Error on authenticateUser',
    'Forgot email for unknown user:',
    '{"envelope":{"from":"',
    'Bad forgot password:',
    '{"data":{',
    ' saved for user ',
    'Id generated: ',
    'bad cookie!',
    'Changing PW',
    'Changing Email',
    'bad password for:',
    'imgur post fail',
    'Error: Parse Error',
    'Message sent:',
    'Saving new user.',
    'invalid username',
    'User exists.',
    'User Exists.',
    'User email exists.',
];

function findFiles(files, directory) {
    fs.readdirSync(directory).forEach((entry) => {
        const fullPath = path.join(directory, entry);
        if (fs.statSync(fullPath).isDirectory()) findFiles(files, fullPath);
        else files.push(fullPath);
    });
    return files;
}

function isRealUsername(username) {
    const minBadUsernameLength = 12;
    if (username.length < minBadUsernameLength) {
        return true;
    }
    for (const badUsernameSubstring of badUsernameSubstrings) {
        if (username.indexOf(badUsernameSubstring) > -1) {
            return false;
        }
    }
    return true;
}

function addUserIfDoesntExist(username, timestamp, source) {
    if (!usernames[username]) {
        usernames[username] = {
            username,
            registered: null,
            firstSeen: timestamp,
            lastSeen: timestamp,
            source,
        };
    }
}

function lineReader(fileName) {
    const raw = fs.createReadStream(fileName);
    return readline.createInterface({
        input: fileName.endsWith('.gz') ? raw.pipe(zlib.createGunzip()) : raw,
        crlfDelay: Infinity,
    });
}

async function importLogFile(fileName) {
    console.log(`reading log ${fileName}`);
    const userRegistrationQueue = [];
    let lineNumber = 0;

    for await (const line of lineReader(fileName)) {
        lineNumber++;
        if (lineNumber % 1000000 === 0) console.log(lineNumber);

        let log;
        try {
            log = JSON.parse(line);
        } catch (err) {
            continue;
        }

        const username = log.username ? String(log.username).trim() : null;
        const timestamp = log.timestamp;
        if (!username || !timestamp) continue;

        // Early logs put the username for an attempted registration on one
        // line and (potentially) a "user exists" error on a later line; keep
        // a queue so failed registrations can be popped back off.
        if (username === 'User exists.' || username === 'User Exists.') {
            userRegistrationQueue.pop();
            continue;
        }

        if (!isRealUsername(username)) continue;

        if (log.message === 'Saving new user' || log.url === '/register') {
            userRegistrationQueue.push({ username, registered: timestamp });
        }

        if (log.message === 'signed in' || log.message === 'saved library'
            || log.url === '/signin' || log.url === '/saveLibrary') {
            addUserIfDoesntExist(username, timestamp, 'log');
            if (timestamp < usernames[username].firstSeen) usernames[username].firstSeen = timestamp;
            if (timestamp > usernames[username].lastSeen) usernames[username].lastSeen = timestamp;
        }
    }

    userRegistrationQueue.forEach((reg) => {
        addUserIfDoesntExist(reg.username, reg.registered, 'log');
        // Only ever move registration earlier — never let a later attempt
        // (e.g. re-registering an existing name) overwrite a known date.
        const existing = usernames[reg.username].registered;
        if (!existing || reg.registered < existing) {
            usernames[reg.username].registered = reg.registered;
        }
    });
}

async function importDatabaseFile(fileName) {
    console.log(`reading db dump ${fileName}`);
    const dateMatch = path.basename(fileName).match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) {
        console.log(`SKIP ${fileName}: no yyyy-mm-dd in filename to use as snapshot date`);
        return;
    }
    const fileDate = `${dateMatch[1]}T00:00:00.000Z`;
    let lineNumber = 0;

    for await (const line of lineReader(fileName)) {
        lineNumber++;
        if (lineNumber % 100000 === 0) console.log(lineNumber);

        let user;
        try {
            user = JSON.parse(line);
        } catch (err) {
            continue;
        }

        const username = user.username ? String(user.username).trim() : null;
        if (!username) continue;

        addUserIfDoesntExist(username, fileDate, 'database');
        if (!usernames[username].registered) {
            if (fileDate === '2016-07-08T00:00:00.000Z') {
                usernames[username].registered = '2014-09-01T00:00:00.000Z'; // gap in logs from 2014-08 to 2015-01
                num2014Registration++;
            } else {
                usernames[username].registered = fileDate;
            }
            numDBRegistration++;
        }
    }
}

async function main() {
    if (seedPath) {
        const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
        Object.assign(usernames, seed);
        console.log(`seeded ${Object.keys(usernames).length} users from ${seedPath}`);
    }

    const logFiles = findFiles([], logDirectory).sort();
    const databaseFiles = findFiles([], databaseDirectory).sort();

    for (const file of logFiles) {
        await importLogFile(file);
    }

    for (const username in usernames) {
        if (!usernames[username].registered && earlyUsers.indexOf(username) > -1) {
            usernames[username].registered = '2013-11-01T00:00:00.000Z'; // manually grabbed early users from an old db snapshot
            num2013Registration++;
        }
    }

    for (const file of databaseFiles) {
        await importDatabaseFile(file);
    }

    for (const username in usernames) {
        if (!usernames[username].registered) {
            usernames[username].registered = '2024-11-01T00:00:00.000Z';
            numFallbackRegistration++;
        }
    }

    fs.writeFileSync(outputFileName, JSON.stringify(usernames));

    console.log('complete');
    console.log(`num users: ${Object.keys(usernames).length}`);
    console.log(`num 2013 registration: ${num2013Registration}`);
    console.log(`num 2014 registration: ${num2014Registration}`);
    console.log(`num db registration: ${numDBRegistration}`);
    console.log(`num fallback registration: ${numFallbackRegistration}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
