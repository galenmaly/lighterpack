const fs = require('fs');
const es = require('event-stream');
const path = require("path");

//so futureproof
const MIN_DATE = "2036-01-01";
const MAX_DATE = "1970-01-01";

let files = [];
function findFiles(directory) {
    fs.readdirSync(directory).forEach(File => {
        const fullPath = path.join(directory, File);
        if (fs.statSync(fullPath).isDirectory()) return findFiles(fullPath);
        else return files.push(fullPath);
    });
}

if (process.argv.length !== 3) {
    console.error('Expected log directory as argument');
    process.exit(1);
}
  
findFiles(process.argv[2]);

console.log(files);

console.log("starting to read...")

async function readFile(fileDates, fileName) {
    return new Promise((resolve, reject) => {
    let lineNumber = 0;

    let minDate = new Date(MIN_DATE);
    let maxDate = new Date(MAX_DATE);
    
    let s = fs.createReadStream(fileName)
        .pipe(es.split())
        .pipe(es.mapSync(async function(line) {
            s.pause();

            lineNumber += 1;
            if (lineNumber % 100000 === 0) {
                console.log(lineNumber);
            }
            let log;
            try {
                log = JSON.parse(line)
            } catch (err) {
                //noop
                s.resume();
                return;
            }

            let date = new Date(log["timestamp"]);
            if (date < minDate) {
                minDate = date;
            }
            if (date > maxDate) {
                maxDate = date;
            }
            
            s.resume();
        })
        .on('error', function(err){
            console.log('Error while reading file.', err);
            reject();
        })
        .on('end', function(){
            console.log('Read entire file.');
            if (minDate.getDate() != new Date(MIN_DATE).getDate()) {
                fileDates.push({
                    minDate,
                    maxDate,
                    fileName
                });
            } else {
                console.log("non-json file")
            }
            resolve();
        })
    );
    });
}

async function readFiles() {
    let fileDates = [];
    for (let i = 0; i < files.length; i++) {
        let fileName = files[i];
        
        await readFile(fileDates, fileName);
    }
        
    console.log("----- all files read-----")

    console.log(fileDates);

    fileDates.sort((a,b) => {
        return a.minDate < b.minDate ? -1 : 1;
    })

    console.log(fileDates);

    console.log(JSON.stringify(fileDates,null,4));
}

readFiles();
