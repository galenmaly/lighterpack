LighterPack
===========
LighterPack helps you track the gear you bring on adventures.

How to run Lighterpack
-----------

1. Install node.js, npm and mongo
2. ```$ git clone https://github.com/galenmaly/lighterpack.git```
3. Install dependancies ```$ npm install```
4. start mongo ```$ mongod```
5. Start app ```$ npm start```
6. go to http://localhost:8080

Running with Docker & Docker compose
-----------

1. Install docker & docker-compose
2. `cp extIds.example.txt ./extIds.txt`
3. `cp ./config/local.example.json ./config/local.json`
4. `docker-compose up`
5. Visit http://localhost:8080


Future non-feature initiatives
-----------
- Migrate to postgres document store from mongo