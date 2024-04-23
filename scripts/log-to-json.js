const fs = require('fs');
const es = require('event-stream');
const path = require("path");

let files = [];
function findFiles(directory) {
    fs.readdirSync(directory).forEach(File => {
        const fullPath = path.join(directory, File);
        if (fs.statSync(fullPath).isDirectory()) return findFiles(fullPath);
        else return files.push(fullPath);
    });
}

if (process.argv.length !== 4) {
    console.error('Expected plaintext directory and output directory as arguments');
    process.exit(1);
}

const plaintext_dir = process.argv[2];
const out_dir = process.argv[3];
findFiles(plaintext_dir);

console.log(files);

console.log("starting to read...")


async function writeLine(writeStream, line) {
    return new Promise((resolve, reject) => {
        writeStream.write(line, () => {
            resolve();
        });
    })
}

async function readFile(fileName) {
    return new Promise((resolve, reject) => {
    let lineNumber = 0;
    
    let relativePath = fileName.substr(plaintext_dir.length);

    let outFileName = out_dir + relativePath;
    let outFileDir = outFileName.substr(0,outFileName.lastIndexOf("\\"));

    if (!fs.existsSync(outFileDir)) {
        fs.mkdirSync(outFileDir);
    }
    
    let writeStream = fs.createWriteStream(outFileName, { flags : 'w' });

    let s = fs.createReadStream(fileName)
        .pipe(es.split())
        .pipe(es.mapSync(async function(line) {
            s.pause();

            lineNumber += 1;
            if (lineNumber % 10000 === 0) {
                console.log(lineNumber);
            }
            if (line.substr(4,1) !== "-" || line.substr(7,1) !== "-" || line.substr(23,4)  !== "Z - ") {
                s.resume();
                return;
            }

            lineSplit = line.split(" - ");

            if (lineSplit.length < 5) {
                console.log(`unexpected log line: ${lineNumber}`);
                console.log(line);
                s.resume()
                return;
            }

            out  = {
                timestamp: lineSplit[0],
                "remote-addr": lineSplit[1],
                url: lineSplit[2],
                "user-agent": lineSplit[3],
                username: lineSplit[4]
            };
            await writeLine(writeStream, JSON.stringify(out) + "\n")
                    
            s.resume();
        })
        .on('error', function(err){
            console.log('Error while reading file.', err);
            reject();
        })
        .on('end', function(){
            console.log('Read entire file.');
            writeStream.end();
            writeStream.close();
            resolve();
        })
    );
    });
}

async function readFiles() {
    for (let i = 0; i < files.length; i++) {
        let fileName = files[i];
        
        await readFile(fileName);
    }
}

readFiles();