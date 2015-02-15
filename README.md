LighterPack
===========
LighterPack is a website to track the gear you take on adventures. It is still in Beta.

LighterPack is built on a node.js/jQuery/vanillaJS/mongo stack.

How to run Lighterpack
===========
1) Install node.js and mongo

2) git clone https://github.com/galenmaly/lighterpack.git

3) Install packages:
   npm install express
   npm install cookie-parser
   npm install body-parser
   npm install mongojs
   npm install mustache
   npm install node.extend
   npm install nodemailer

4) run via nodejs app.js

===========

Future non-feature initiatives:
- Migrate to postgres document store from mongo
- Split up LESS files into more logical files (using LESS imports to keep the same # of .css files)
- Split up edit.js somehow + setup a build step to concat files back together
