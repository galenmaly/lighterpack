// Parse recursively through a directory of logs and determine the user registration date and user last seen date
// Expects all logs to be in JSON, but has logic to deal with early poor log formatting (stuffing non-username data into username field)
// Also parses through database exports to find users missing from the logs

const fs = require('fs');
const path = require("path");
const es = require('event-stream');

if (process.argv.length !== 5) {
    console.error('Expected log directory, database directory, and output file as argument');
    process.exit(1);
}

const logDirectory = process.argv[2];
const databaseDirectory = process.argv[3];
const outputFileName = process.argv[4];

const logFiles = findFiles([], logDirectory);
const databaseFiles = findFiles([], databaseDirectory);

const usernames = {};
const earlyUsers = []; // manually populate

let num2013Registration = 0;
let num2014Registration = 0;
let num2024Registration = 0;
let numDBRegistration = 0;

// probably not comprehensive
const badUsernameSubstrings = [
    "Bad password for:",
    "sent username message for user:",
    "Attempting to send username to",
    "Attempting to send new password to",
    "Forgot password for unknown user",
    "password changed for user:",
    "Forgot password lookup error for:",
    "Bad usersfor:",
    "Bad users for:",
    "Error on authenticateUser for:",
    "Forgot email lookup error for:",
    "Forgot password lookup error for:",
    "Error on authenticate user",
    "Error on authenticateUser",
    "Forgot email for unknown user:",
    "sent username message for user:",
    '{"envelope":{"from":"',
    "Bad forgot password:",
    '{"data":{',
    " saved for user ",
    "Id generated: ",
    "bad cookie!",
    "Changing PW",
    "Changing Email",
    "bad password for:",
    "imgur post fail",
    "Error: Parse Error",
    "Message sent:",
    "Saving new user.",
    "invalid username",
    "User exists.",
    "User Exists.",
    "User email exists."
];

function findFiles(files, directory) {
    fs.readdirSync(directory).forEach(File => {
        const fullPath = path.join(directory, File);
        if (fs.statSync(fullPath).isDirectory()) return files.concat(findFiles(files, fullPath));
        else return files.push(fullPath);
    });
    return files;
}

function isRealUsername(username) {
    const minBadUsernameLength = 12;
    if (username.length < minBadUsernameLength) {
        return true;
    }

    for (let badUsernameSubstring of badUsernameSubstrings) {
        if (username.search(badUsernameSubstring) > -1) {
            return false;
        }
    }
    return true;
}

function addUserIfDoesntExist(username, timestamp, source) {
    if (!usernames[username]) {
        usernames[username] = {
            username: username,
            registered: null,
            firstSeen: timestamp,
            lastSeen: timestamp,
            source: source
        }
    }
}

async function importLogFile(fileName) {
    const userRegistrationQueue = [];

    return new Promise((resolve, reject) => {   
        console.log("starting to read..." + fileName)
        let lineNumber = 0;
        var s = fs.createReadStream(fileName)
            .pipe(es.split())
            .pipe(es.mapSync(async function(line){
                s.pause();
    
                lineNumber += 1;
                if (lineNumber % 1000000 === 0) {
                    console.log(lineNumber);
                }
                let log;
                try {
                    log = JSON.parse(line)
                } catch (err) {
                    //noop
                    //console.log("error on line:" + lineNumber)

                    s.resume();
                    return;
                }

                const username = log.username ? log.username.trim() : null;
                const timestamp = log.timestamp;

                // Early logs put the username for an an attempted registration on one line, 
                // and (potentially) a "user exists" error message on a later line.
                // To accommodate this we will keep a queue of the users we want to mark as registered
                // so we can pop if the registration was not successful.
                if (username && (username === "User exists." || username === "User Exists.")) {
                    const userRegistration = userRegistrationQueue.pop();
                } 

                if (username && isRealUsername(username)) {
                    if (log.message === "Saving new user" || log.url === "/register") {
                        userRegistrationQueue.push({username, registered: timestamp});
                    }

                    if (log.message === "signed in" || log.message === "saved library" || log.url === "/signin" || log.url === "/saveLibrary") {
                        addUserIfDoesntExist(username, timestamp, "log");
                        if (log.timestamp < usernames[username].firstSeen) {
                            usernames[username].firstSeen = timestamp;
                        }
                        if (log.timestamp > usernames[username].lastSeen) {
                            usernames[username].lastSeen = timestamp;
                        }
                    }
                }

                s.resume();
            })
            .on('error', function(err){
                console.log('Error while reading file.', err);
                reject(err);
            })
            .on('end', function(){
                userRegistrationQueue.forEach((userRegistration) => {
                    addUserIfDoesntExist(userRegistration.username, userRegistration.registered, "log");
                    usernames[userRegistration.username].registered = userRegistration.registered;
                });
                console.log('Read entire file.')
                resolve();
            })
        );
    });
}

async function importDatabaseFile(fileName) {
    const fileDate = fileName.substr(fileName.lastIndexOf("\\")+1,10) + "T00:00:00.000Z";
    return new Promise((resolve, reject) => {   
        console.log("starting to read..." + fileName)
        let lineNumber = 0;
        var s = fs.createReadStream(fileName)
            .pipe(es.split())
            .pipe(es.mapSync(async function(line){
                s.pause();

                lineNumber += 1;
                if (lineNumber % 10000 === 0) {
                    console.log(lineNumber);
                }

                let user;
                try {
                    user = JSON.parse(line)
                } catch (err) {
                    s.resume();
                    return;
                }

                const username = user.username ? user.username.trim() : null;
                
                if (username) {
                    addUserIfDoesntExist(username, fileDate, "database");

                    if (!usernames[username].registered) {
                        if (fileDate === "2016-07-08T00:00:00.000Z") {
                            usernames[username].registered = "2014-09-01T00:00:00.000Z"; //gap in logs from 2014-08 to 2015-01
                            num2014Registration++;
                        } else {
                            usernames[username].registered = fileDate;
                        }
                        numDBRegistration++;
                    }
                }

                s.resume();
            })
            .on('error', function(err){
                console.log('Error while reading file.', err);
                reject(err);
            })
            .on('end', function(){
                resolve();
            })
        );
    });
}

async function findUserDates(logFiles, databaseFiles, outputFileName) {
    for (let i = 0; i < logFiles.length; i++) {
        let file = logFiles[i];
        await importLogFile(file);
    }

    for (let username in usernames) {
        if (!usernames[username].registered) {
            if (earlyUsers.indexOf(username) > -1) {
                usernames[username].registered = "2013-11-01T00:00:00.000Z"; // manually grabbed early users from an old db snapshot
                num2013Registration++;
            }
        }
    }

    for (let i = 0; i < databaseFiles.length; i++) {
        let file = databaseFiles[i];
        await importDatabaseFile(file);
    }

    for (let username in usernames) {
        if (!usernames[username].registered) {
            usernames[username].registered = "2024-11-01T00:00:00.000Z";
            num2024Registration++;                
        }
    }


    fs.writeFile(outputFileName, JSON.stringify(usernames), err => {
        console.log(err);
    });

    console.log("complete");
    console.log(`num users: ${Object.keys(usernames).length}`);
    console.log(`num 2013 registration: ${num2013Registration}`);
    console.log(`num 2014 registration: ${num2014Registration}`);
    console.log(`num 2024 registration: ${num2024Registration}`);
    console.log(`num db registration: ${numDBRegistration}`);

}

findUserDates(logFiles, databaseFiles, outputFileName);

