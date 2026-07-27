LighterPack
===========
LighterPack helps you track the gear you bring on adventures.

How to run Lighterpack
-----------

1. Install node.js, npm and postgres
2. ```$ git clone https://github.com/galenmaly/lighterpack.git```
3. Install dependancies ```$ npm install```
4. Configure postgres
```
sudo -u postgres psql -c "CREATE USER lp WITH PASSWORD 'DBPASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE lighterpack OWNER lp;"
sudo -u postgres psql lighterpack < db/01_users.sql
```
5. Create a local.env file ```cp config/default.json config/local.json```
6. Edit the db config params in local.json
7. Start back end ```$ npm run dev```
8. Start front end ```$ npm run vite```
9. go to http://localhost:5173
10. Share urls can be seen on http://localhost:3000
