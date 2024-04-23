import sys

filename = sys.argv[1]

print(filename)

with open(filename, encoding="utf-8") as f:
    ids = []
    lines = f.read().splitlines()
    lineJsonSearch = '"url":"/r/'
    idLength = 6;
    numListRequests = 0
    for line in lines:
        if '"status":"200"' in line and lineJsonSearch in line:
            jsonStart = line.index(lineJsonSearch)
            start = jsonStart + len(lineJsonSearch)
            end = start + idLength
            id = line[start:end]
            numListRequests += 1
            if id not in ids:
                ids.append(id)
    print(ids)
    print(len(ids))
    print(len(lines))
    print(numListRequests)