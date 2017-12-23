const bcrypt = require('bcryptjs');
const crypto = require("crypto");
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

//one day in many years this can go away.
eval(fs.readFileSync(path.join(__dirname, './sha3.js'))+'');

router.post("/register", function(req, res) {
    var username = req.body.username;
    const password = req.body.password;
    var email = req.body.email;

    var errors = [];

    if (!username) {
        errors.push({field: "username", message: "Please enter a username."});
    }

    username = username.trim();

    if (username && (username.length < 3 || username.length > 32)) {
        errors.push({field: "username", message: "Please enter a username between 3 and 32 characters."});
    }

    if (!email) {
        errors.push({field: "email", message: "Please enter an email."});
    }

    email = email.trim();

    if (!password) {
        errors.push({field: "password", message: "Please enter a password."});
    }

    if (password && (password.length < 5 || password.length > 60)) {
        errors.push({field: "password", message: "Please enter a password between 5 and 60 characters."});
    }

    if (errors.length) {
        return res.status(400).json({errors});
    }

    awesomeLog(req, username);

    db.users.find({username: username}, function(err, users) {
        if (err || users.length) {
            awesomeLog(req, "User exists.");
            return res.status(400).json({errors: [{field: "username", message: "That username already exists, please pick a different username."}]});
        }

        db.users.find({email: email}, function(err, users) {
            if (err || users.length) {
                awesomeLog(req, "User email exists.");
                return res.status(400).json({errors: [{field: "email", message: "A user with that email already exists."}]});
            }

            bcrypt.genSalt(10, function(err, salt) {
                bcrypt.hash(password, salt, function(err, hash) {
                    crypto.randomBytes(48, function(ex, buf) {
                        var token = buf.toString('hex');
                        var library;
                        if (req.body.library) {
                            try {
                               library = JSON.parse(req.body.library)
                            }
                            catch (e) {
                               return res.status(400).json({errors: [{message: "Unable to parse your library. Contact support."}]});
                            } 
                        } else {
                            library = new Library().save();
                        }

                        var newUser = {
                            username: username,
                            password: hash,
                            email: email,
                            token: token,
                            library: library,
                            syncToken: 0
                        }
                        awesomeLog(req, "Saving new user.");
                        db.users.save(newUser);
                        var out = {username: username, library: JSON.stringify(newUser.library), syncToken: 0};
                        res.cookie("lp", token,  { path: "/", maxAge: 365*24*60*1000 });
                        return res.status(200).json(out);
                    });
                });
            });
        });
    });
});

router.post("/signin", function(req, res) {
    authenticateUser(req, res, returnLibrary);
});

function returnLibrary(req, res, user) {
    awesomeLog(req, user.username);
    if (!user.syncToken) {
        user.syncToken = 0;
        db.users.save(user);
    }
    return res.json({username: user.username, library: JSON.stringify(user.library), syncToken: user.syncToken});
}

router.post("/saveLibrary", function(req, res) {
    authenticateUser(req, res, saveLibrary);
});

function saveLibrary(req, res, user) {
    if (!req.body.username || typeof req.body.syncToken === "undefined" || !req.body.data) {
        return res.status(400).json({status: "An error occurred while saving your data."});
    }

    if (req.body.username != user.username) {
        return res.status(401).json({status: "Please login again."});
    }

    if (req.body.syncToken != user.syncToken) {
        return res.status(400).json({status: "Your list is out of date - please refresh your browser."});
    }

    var library;
    try {
        library = JSON.parse(req.body.data)
    } catch(e) {
        return res.status(400).json({errors: [{message: "An error occurred while saving your data - unable to parse library. If this persists, please contact support."}]});
    }

    user.library = library;
    user.syncToken++;
    db.users.save(user);
    awesomeLog(req, user.username);
    return res.status(200).json({status: "success", syncToken: user.syncToken});
}

router.post("/forgotPassword", function(req, res) {
    awesomeLog(req);
    var username = req.body.username;
    if (!username) {
        awesomeLog(req, "Bad forgot password:" + username);
        return res.status(400).json({errors: [{message: "Please enter a username."}]});
    }

    username = username.trim();

    if (username.length < 1 || username.length > 32) {
        awesomeLog(req, "Bad forgot password:" + username);
        return res.status(400).json({errors: [{message: "Please enter a username."}]});
    }

    db.users.find({username: username}, function(err, users) {
        if( err ) {
            awesomeLog(req, "Forgot password lookup error for:" + username)
            return res.status(500).json({status: "An error occurred"});
        } else if ( !users.length ) {
            awesomeLog(req, "Forgot password for unknown user:" + username)
            return res.status(500).json({status: "An error occurred."});
        }
        var user = users[0];
        require('crypto').randomBytes(12, function(ex, buf) {
            var newPassword = buf.toString('hex');

            bcrypt.genSalt(10, function(err, salt) {
                bcrypt.hash(newPassword, salt, function(err, hash) {
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
                            return res.status(500).json({status: "An error occurred"});
                        } else {
                            db.users.save(user);
                            var out = {username: username};
                            awesomeLog(req, "Message sent: " + response.message);
                            awesomeLog(req, "password changed for user:" + username);
                            return res.status(200).json(out);
                        }
                    });
                });
            });
        });
    });
});

router.post("/forgotUsername", function(req, res) {
    awesomeLog(req);
    var email = req.body.email;
    if (!email) {
        awesomeLog(req, "Bad forgot username:" + email);
        return res.status(400).json({errors: [{message: "Please enter a valid email."}]});
    }

    email = email.trim();

    if (email.length < 1) {
        awesomeLog(req, "Bad forgot username:" + email);
        return res.status(400).json({errors: [{message: "Please enter a valid email."}]});
    }

    db.users.find({email: email}, function(err, users) {
        if (err) {
            awesomeLog(req, "Forgot email lookup error for:" + email)
            return res.status(500).json({status: "An error occurred"});
        } else if ( !users.length ) {
            awesomeLog(req, "Forgot email for unknown user:" + email)
            return res.status(400).json({status: "An error occurred"});
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
                return res.status(500).json({status: "An error occurred"});
            } else {
                var out = {email: email};
                awesomeLog(req, "Message sent: " + response.message);
                awesomeLog(req, "sent username message for user:" + username);
                return res.status(200).json(out);
            }
        });
    });
});

router.post("/account", function(req, res) {
    authenticateUser(req, res, account);
});

function account(req, res, user) {
    //TODO: check for duplicate emails

    verifyPassword(user.username, req.body.currentPassword)
    .then((user) => {
        if (req.body.newPassword) {
            var errors = [];

            if (req.body.newPassword.length < 5 || req.body.newPassword.length > 60) {
                errors.push({field: "newPassword", message: "Please enter a password between 5 and 60 characters."});
            }

            if (errors.length) {
                return res.status(400).json({errors});
            }

            bcrypt.genSalt(10, function(err, salt) {
                bcrypt.hash(req.body.newPassword, salt, function(err, hash) {
                    user.password = hash;
                    awesomeLog(req, "Changing PW - " + user.username);

                    if (req.body.newEmail) {
                        user.email = req.body.newEmail;
                        awesomeLog(req, "Changing Email - " + user.username);
                    }

                    db.users.save(user);
                    return res.status(200).json({status: "success"});
                });
            });
        } else if (req.body.newEmail) {
            user.email = req.body.newEmail;
            awesomeLog(req, "Changing Email - " + user.username);
            db.users.save(user);
            return res.status(200).json({status: "success"});
        }
    })
    .catch((err) => {
        res.status(400).json({errors: [{field: "currentPassword", message: "Your current password is incorrect."}]});
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
            return res.status(500).json({status: "An error occurred"});
        }
        if (!files || !files.image) {
            awesomeLog(req, "No image in upload");
            return res.status(500).json({status: "An error occurred"});
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
                    return res.status(500).json({status: "An error occurred."});
                } else if (!body) {
                    awesomeLog(req, "imgur post fail!!");
                    awesomeLog(req, e);
                    return res.status(500).json({status: "An error occurred."});
                } else if (r.statusCode !== 200 || body.error) {
                    awesomeLog(req, "imgur post fail!!!");
                    awesomeLog(req, e);
                    awesomeLog(req, body);
                    return res.status(500).json({status: "An error occurred."});
                } else {
                    awesomeLog(req, body);
                    return res.send(body);
                }
            });
        });
    });
}

function authenticateUser(req, res, callback) {
    if (!req.cookies.lp && (!req.body.username || !req.body.password)) {
        return res.status(401).json({status: "Please log in."});
    }
    if (req.body.username && req.body.password) {
        const username = req.body.username.toLowerCase().trim();
        const password = req.body.password;
        verifyPassword(username, password)
        .then((user) => {
            generateSession(req, res, user, callback);
        })
        .catch((err) => {
            console.log(err);
            if (err.code && err.status) {
                awesomeLog(req, err.status)
                res.status(err.code).json({status: err.status});
            } else {
                res.status(500).json({status: "An error occurred, please try again later."});
            }
        });
    } else {
        db.users.find({token: req.cookies.lp}, function(err, users) {
            if (err) {
                awesomeLog(req, "Error on authenticateUser else for:" + req.body.username + ", " + req.body.password )
                return res.status(500).json({status: "An error occurred, please try again later."});;
            } else if (!users || !users.length) {
                awesomeLog(req, "bad cookie!");
                return res.status(401).json({status: "Please log in again."});
            }
            callback(req, res, users[0]);
        });
    }
}

function verifyPassword(username, password) {
    return new Promise((resolve, reject) => {
        db.users.find({username: username}, function(err, users) {
            if (err) {
                return reject({code: 500, status: "An error occurred, please try again later."});
            } else if (!users || !users.length) {
                return reject({code: 404, status: "Invalid username and/or password."});
            }

            const user = users[0];

            bcrypt.compare(password, user.password, function(err, result) {
                if (err) {
                    return reject({code: 500, status: "An error occurred, please try again later."});
                }
                if (!result) {
                    const sha3password = CryptoJS.SHA3(password + username).toString(CryptoJS.enc.Base64);
                    bcrypt.compare(sha3password, user.password, function(err, result) {
                        if (err) {
                            reject({code: 500, status: "An error occurred, please try again later."});
                        }
                        if (!result) {
                            reject({code: 404, status: "Invalid username and/or password."});
                        } else {
                            bcrypt.genSalt(10, function(err, salt) {
                                if (err) {
                                    return reject({code: 500, status: "An error occurred, please try again later."});
                                }
                                bcrypt.hash(password, salt, function(err, hash) {
                                    if (err) {
                                        return reject({code: 500, status: "An error occurred, please try again later."});
                                    }
                                    user.password = hash;
                                    db.users.save(user);
                                    resolve(user);
                                });
                            });
                        }
                    });
                } else {
                    resolve(user);
                }
            });
        });
    });
}

function generateSession(req, res, user, callback) {
    crypto.randomBytes(48, function(ex, buf) {
        var token = buf.toString("hex");
        user.token = token;
        db.users.save(user);
        res.cookie("lp", token, { path: "/", maxAge: 365*24*60*1000 });
        callback(req, res, user);
    });
}

module.exports = router;