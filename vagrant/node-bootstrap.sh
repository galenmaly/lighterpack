#!/usr/bin/env bash

# Get root up in here
sudo su

service puppet stop
service chef-client stop

update-rc.d puppet disable
update-rc.d chef-client disable

# Just a simple way of checking if we need to install everything
if [ ! -d "/var/www" ]
then
    # Update and begin installing some utility tools
    apt-get -y update
    apt-get -y install git

    # Install mongodb
    apt-get -y install mongodb

    # Install nodejs and dependencies for lighterpack
    apt-get install -y nodejs
    apt-get install -y npm

    # Download git repo
    git clone https://github.com/galenmaly/lighterpack.git /var/www/lighterpack

    # Move to the directory so we install the libraries in correct folder
    cd /var/www/lighterpack

    # Install nodejs libraries
    npm install express
    npm install cookie-parser
    npm install body-parser
    npm install mongojs
    npm install mustache
    npm install node.extend
    npm install nodemailer
    npm install connect
    npm install compression
    npm install nodemailer-sendmail-transport
    npm install formidable



    # Victory!
    echo "You're all done!"

    # Run it
    nohup nodejs app.js &> /var/log/lighterpack.log &
fi