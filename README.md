LighterPack
===========
LighterPack is a website to track the gear you take on adventures. It is still in Beta.

LighterPack is built on a node.js/jQuery/vanillaJS/mongo stack.

How to run Lighterpack
-----------

1. Install node.js, npm and mongo
2. ```$ git clone https://github.com/galenmaly/lighterpack.git```
3. Create a config.js and extIds.txt based on the wiki: https://github.com/galenmaly/lighterpack/wiki/Config-files
4. Install dependancies ```$ npm install```
5. start mongo ```$ mongod```
6. Start app ```$ node app.js```
7. go to http://localhost:3000

Running with Vagrant
-----------

1. Install Vagrant and VirtualBox
2. Download this git repository.
3. Create a config.js and extIds.txt in /var/www/lighterpack based on the wiki: https://github.com/galenmaly/lighterpack/wiki/Config-files
4. Run $ `vagrant up` in the folder where you downloaded the git repository.
5. Open a web browser to http://localhost:3000

You can ssh to the machine by typing `vagrant ssh` (or `ssh -p 2222 localhost`)

Future non-feature initiatives
-----------
- Migrate to postgres document store from mongo
- Split up LESS files into more logical files (using LESS imports to keep the same # of .css files)
- Split up edit.js somehow + setup a build step to concat files back together
