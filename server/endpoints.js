const path = require("path");
const express = require("express");
const router = express.Router();
const fs = require("fs");
const request = require("request");
const nodemailer = require("nodemailer");
const sendmailTransport = require("nodemailer-sendmail-transport");
const transport = nodemailer.createTransport(sendmailTransport({}));
const formidable = require("formidable");
const mongojs = require("mongojs");
const config = require("config");
const awesomeLog = require("./log.js");

const collections = ["users", "libraries"];
const db = mongojs(config.get("databaseUrl"), collections);

const dataTypes = require("../client/dataTypes.js");
const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

router.post("/register", function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    var email = req.body.email;
    if (!username || username.length < 1 || username.length > 24) {
        res.status(400).send({status: "Invalid username."});
        awesomeLog(req, "invalid username");
        return;
    }
    if (!password) {
        res.status(400).send("Invalid password.");
        awesomeLog(req, "invalid Password");
        return;
    }
    if (!email) {
        res.status(400).send("Invalid email.");
        awesomeLog(req, "invalid Email");
        return;
    }
    awesomeLog(req, username);

    db.users.find({username: username}, function(err, users) {
        if( err || users.length) {
            awesomeLog(req, "User Exists.");
            res.status(400).send({status: "That user already exists."});
            return;
        }
        require('crypto').randomBytes(48, function(ex, buf) {
            var token = buf.toString('hex');
            var newUser = {
                username: username,
                password: password,
                email: email,
                token: token,
                library: JSON.parse(req.body.library)
            }
            awesomeLog(req, "Saving new user.");
            db.users.save(newUser);
            var out = {username: username, library: JSON.stringify(newUser.library)};
            res.cookie("lp", token,  { path: "/", maxAge: 365*24*60*1000 });
            res.send(out);
        });
    });
});

router.post("/signin", function(req, res) {
    authenticateUser(req, res, returnLibrary);
});

function returnLibrary(req, res, user) {
    res.send({username: user.username, library: JSON.stringify(user.library)});
    awesomeLog(req, user.username);
}

router.post("/saveLibrary", function(req, res) {
    authenticateUser(req, res, saveLibrary);
});

function saveLibrary(req, res, user) {
    try {
        user.library = JSON.parse(req.body.data);
        db.users.save(user);
        res.status(200).json({status: "success"});
        awesomeLog(req, user.username);
    } catch(e) {
        res.status(400).json({status: "error"});
        awesomeLog(req, user.username + " - " + e);
    }
}

router.post("/externalId", function(req, res) {
    authenticateUser(req, res, externalId);
});


router.post("/forgotPassword", function(req, res) {
    awesomeLog(req);
    var username = req.body.username;
    if (!username || username.length < 1 || username.length > 24) {
        res.status(400).send({status: "Invalid username."});
        awesomeLog(req, "Bad forgot password:" + username);
        return;
    }

    db.users.find({username: username}, function(err, users) {
        if( err ) {
            res.status(500).send({status: "An error occurred"});
            awesomeLog(req, "Forgot password lookup error for:" + username)
            return;
        } else if ( !users.length ) {
            res.status(400).send({status: "An error occurred."});
            awesomeLog(req, "Forgot password for unknown user:" + username)
            return;
        }
        var user = users[0];
        require('crypto').randomBytes(12, function(ex, buf) {
            var newPassword = buf.toString('hex');

            var hash = CryptoJS.SHA3(newPassword+username);
            hash = hash.toString(CryptoJS.enc.Base64);

            user.password = hash;
            var email = user.email;

            var message = "Hello " + username + ",\n Apparently you forgot your password. Here's your new one: \n\n Username: " + username + "\n Password: " + newPassword + "\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!";

            var mailOptions = {
                from: "LighterPack <info@lighterpack.com>",
                to: email,
                subject: "Your new LighterPack password",
                text: message
            }

            awesomeLog(req, "Attempting to send new password to:" + email);
            transport.sendMail(mailOptions, function(error, response){
                if (error) {
                    awesomeLog(req, error);
                } else {
                    db.users.save(user);
                    var out = {username: username};
                    res.send(out);
                    awesomeLog(req, "Message sent: " + response.message);
                    awesomeLog(req, "password changed for user:" + username);
                }
            });
        });
    });
});

router.post("/forgotUsername", function(req, res) {
    awesomeLog(req);
    var email = req.body.email;
    if (!email || email.length < 1) {
        res.status(400).send({status: "Invalid email."});
        awesomeLog(req, "Bad forgot username:" + email);
        return;
    }

    db.users.find({email: email}, function(err, users) {
        if( err ) {
            res.status(500).send({status: "An error occurred"});
            awesomeLog(req, "Forgot email lookup error for:" + email)
            return;
        } else if ( !users.length ) {
            res.status(400).send({status: "An error occurred"});
            awesomeLog(req, "Forgot email for unknown user:" + email)
            return;
        }
        var user = users[0];
        var username = user.username;

        var message = "Hello " + username + ",\n Apparently you forgot your username. Here It is: \n\n Username: " + username + "\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!";

        var mailOptions = {
            from: "LighterPack <info@lighterpack.com>",
            to: email,
            subject: "Your LighterPack username",
            text: message
        }

        awesomeLog(req, "Attempting to send username to:" + email);
        transport.sendMail(mailOptions, function(error, response){
            if (error) {
                awesomeLog(req, error);
            } else {
                var out = {email: email};
                res.send(out);
                awesomeLog(req, "Message sent: " + response.message);
                awesomeLog(req, "sent username message for user:" + username);
            }
        });
    });
});

router.post("/account", function(req, res) {
    authenticateUser(req, res, account);
});

function account(req, res, user) {
    awesomeLog(req, user.name);
    if (req.body.newPassword) {
        user.password = req.body.newPassword;
        awesomeLog(req, "Changing PW - " + user.username);
    }

    if (req.body.newEmail) {
        user.email = req.body.newEmail;
        awesomeLog(req, "Changing Email - " + user.username);
    }

    db.users.save(user);

    res.status(200).send({status: "success"});
    return;
};


function externalId(req, res, user) {
    var filePath = path.join(__dirname, "extIds.txt");

    fs.readFile(filePath, function(err, data) { // read file to memory
        if (!err) {
            data = data.toString(); // stringify buffer
            var position = data.indexOf('\n'); // find position of new line element
            if (position != -1) { // if new line element found
                var myId = data.substr(0, position);
                data = data.substr(position + 1); // subtract string based on first line length
                fs.writeFile(filePath, data, function(err) { // write file
                    if (err) { // if error, report
                        awesomeLog(req, err);
                    }
                });
                res.send(myId);
                awesomeLog(req, user.username + " - " + myId);

                if (typeof user.externalIds == "undefined") user.externalIds = [myId];
                else user.externalIds.push(myId);

                db.users.save(user);
            } else {
                awesomeLog(req, 'External ID File: no lines found!!!111oneoneone');
            }
        } else {
            awesomeLog(req, "ERROR OPENING EXTERNAL ID FILE");
            awesomeLog(req, err);
        }
    });
}

router.post("/imageUpload", function(req, res) {
    //authenticateUser(req, res, imageUpload);
    awesomeLog(req);
    imageUpload(req, res, {});
});

function imageUpload(req, res, user) {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        if (err) {
            awesomeLog(req, "form parse error");
            res.status(500).send({status: "An error occurred"});
            return;
        }
        if (!files || !files.image) {
            awesomeLog(req, "No image in upload");
            res.status(500).send({status: "An error occurred"});
            return;
        }

        var path = files.image.path;
        var imgurRequest = request.defaults({json: true});
        fs.readFile(path, function(e, img_data) {
            var temp = { uri: "https://api.imgur.com/3/image", headers: {"Authorization": "Client-ID " + config.get('imgurClientID')}};
            temp.body = img_data.toString("base64");
            imgurRequest.post(temp, function(e, r, body) {
                if (e) {
                    awesomeLog(req, "imgur post fail!");
                    awesomeLog(req, e);
                    awesomeLog(req, body);
                    res.status(500).send({status: "An error occurred."});
                } else if (!body) {
                    awesomeLog(req, "imgur post fail!!");
                    awesomeLog(req, e);
                    res.status(500).send({status: "An error occurred."});
                } else if (r.statusCode !== 200 || body.error) {
                    awesomeLog(req, "imgur post fail!!!");
                    awesomeLog(req, e);
                    awesomeLog(req, body);
                    res.status(500).send({status: "An error occurred."});
                } else {
                    awesomeLog(req, body);
                    res.send(body);
                }
            });
        });
    });
}

function authenticateUser(req, res, callback) {
    if (!req.cookies.lp && (!req.body.username || !req.body.password)) {
        res.status(401).json({status: "Please Authenticate"});
        return;
    }
    if (req.body.username) {
        db.users.find({username: req.body.username, password: req.body.password}, function(err, users) {
            if (err) {
                res.status(500).json({status: "An error occurred, please try again later."});
                awesomeLog(req, "Error on authenticateUser for:" + req.body.username + ", " + req.body.password )
                return;
            } else if (!users || !users.length) {
                    res.status(401).json({status: "Invalid username and/or password."});
                    awesomeLog(req, "Bad password for: "+req.body.username);
                    return;
            }
            var user = users[0]
            require("crypto").randomBytes(48, function(ex, buf) {
                    var token = buf.toString("hex");
                    user.token = token;
                    db.users.save(user);
                    res.cookie("lp", token, { path: "/", maxAge: 365*24*60*1000 });
                    callback(req, res, user);
            });
        });
    } else {
        db.users.find({token: req.cookies.lp}, function(err, users) {
            if (err) {
                res.status(500).json({status: "An error occurred, please try again later."});
                awesomeLog(req, "Error on authenticateUser else for:" + req.body.username + ", " + req.body.password )
                return;
            } else if (!users || !users.length) {
                    awesomeLog(req, "bad cookie!");
                    res.status(401).json({status: "Please log in again."});
                    return;
            }
            callback(req, res, users[0]);
        });
    }
}

module.exports = router;