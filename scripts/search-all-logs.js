// Parse recursively through a directory of logs and text search them.

const fs = require('fs');
const path = require("path");
const es = require('event-stream');

if (process.argv.length !== 3) {
    console.error('Expected log directory as argument');
    process.exit(1);
}

const logDirectory = process.argv[2];

const logFiles = findFiles([], logDirectory);

function findFiles(files, directory) {
    fs.readdirSync(directory).forEach(File => {
        const fullPath = path.join(directory, File);
        if (fs.statSync(fullPath).isDirectory()) return files.concat(findFiles(files, fullPath));
        else return files.push(fullPath);
    });
    return files;
}

async function importLogFile(fileName) {
    const logLines = [];

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
                if (line.indexOf(TODO) > -1) { // Search here
                    logLines.push(line);
                }

                s.resume();
            })
            .on('error', function(err){
                console.log('Error while reading file.', err);
                reject(err);
            })
            .on('end', function(){
                resolve(logLines);
            })
        );
    });
}

async function searchLogFiles(logFiles) {
    let allLogLines = [];
    for (let i = 0; i < logFiles.length; i++) {
        let file = logFiles[i];
        let logLines = await importLogFile(file);
        allLogLines = allLogLines.concat(logLines);
    }

    console.log(allLogLines.length);

    jsonLogLines = allLogLines.map((logLine) => {
        let line;
        try {
            line = JSON.parse(logLine);
        } catch (err) {
            line = {}
        }
        return line;
    });

    jsonLogLines.sort((a,b) => {
        return a.timestamp > b.timestamp ? -1 : 1;
    });

    jsonLogLines.forEach((logLine) => {
        console.log(JSON.stringify(logLine));
    })
    console.log("complete");

}

searchLogFiles(logFiles);
