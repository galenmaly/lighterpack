const path = require("path");
const express = require("express");
const router = express.Router();

var fs = require("fs");
var request = require("request");
var Mustache = require("mustache");
var extend = require('node.extend');
var nodemailer = require("nodemailer");
var sendmailTransport = require('nodemailer-sendmail-transport');
var transport = nodemailer.createTransport(sendmailTransport({}));
var formidable = require('formidable');
var markdown = require( "markdown" ).markdown;
var config = require('config')

var collections = ["users", "libraries"];

var mongojs = require('mongojs');
var db = mongojs(config.get('databaseUrl'), collections);

const vueRoutes = [ /* TODO - get this from same data source as Vue */
    { path: "/" },
    { path: "/signin" },
    { path: "/welcome" },
    { path: "/register" },
];

for (var i = 0; i < vueRoutes.length; i++) {
    router.get(vueRoutes[i].path, function(req, res) {
        awesomeLog(req);
        res.sendFile(path.join(__dirname, '../public/index.html'));
    });
}

router.get('/r/:id', function(req, res) {
    var id = req.params.id
    awesomeLog(req);

    if (!id) {
        res.status(400).send("No list specified!");
        return;
    }
    db.users.find({"library.lists.externalId": id}, function(err, users) {
        if (err) {
            res.status(500).send("An error occurred.");
            return;
        }
        if (!users.length) {
            res.status(400).send("Invalid list specified.");
            return;
        }
        var library = new Library();
        var list;

        if (!users[0] || typeof(users[0].library) == "undefined") {
            awesomeLog(req, "Undefined users[0].");
            res.status(500).send("Unknown error.");
        }

        library.load(users[0].library);
        for (var i in library.lists) {
            if (library.lists[i].externalId && library.lists[i].externalId == id) {
                library.defaultListId = library.lists[i].id;
                list = library.lists[i];
                break;
            }
        }

        var chartData = escape(JSON.stringify(list.renderChart("total", false)));
        var renderedCategories = library.render({
            itemTemplate: templates.t_itemShare,
            categoryTemplate: templates.t_categoryShare,
            optionalFields: library.optionalFields,
            unitSelectTemplate: templates.t_unitSelect,
            currencySymbol: library.currencySymbol});

        var renderedTotals = library.renderTotals(templates.t_totals, templates.t_unitSelect, library.totalUnit);

        var model = {listName: list.name,
            chartData: chartData,
            renderedCategories: renderedCategories,
            renderedTotals: renderedTotals,
            optionalFields: library.optionalFields,
            renderedDescription: markdown.toHTML(list.description)};

        model = extend(model, templates);
        res.send(Mustache.render(shareTemplate, model));
    });
});

router.get("/e/:id", function(req, res) {
    var id = req.params.id
    awesomeLog(req);

    if (!id) {
        res.status(400).send("No list specified!");
        return;
    }

    db.users.find({"library.lists.externalId": id}, function(err, users) {
        if (err) {
            res.status(500).send("An error occurred.");
            return;
        }

        if (!users.length) {
            res.status(400).send("Invalid list specified.");
            return;
        }

        var library = new Library();
        var list;

        if (!users[0] || typeof(users[0].library) == "undefined") {
            awesomeLog(req, "Undefined users[0].");
            res.status(500).send("Unknown error.");
        }

        library.load(users[0].library);
        for (var i in library.lists) {
            if (library.lists[i].externalId && library.lists[i].externalId == id) {
                library.defaultListId = library.lists[i].id;
                list = library.lists[i];
                break;
            }
        }

        var chartData = escape(JSON.stringify(list.renderChart("total", false)));

        var renderedCategories = library.render({
                itemTemplate: templates.t_itemShare,
                categoryTemplate: templates.t_categoryShare,
                optionalFields: library.optionalFields,
                unitSelectTemplate: templates.t_unitSelect,
                renderedDescription: markdown.toHTML(list.description),
                currencySymbol: library.currencySymbol});

        var renderedTotals = library.renderTotals(templates.t_totals, templates.t_unitSelect);

        var model = {externalId: id,
            listName: list.name,
            chartData: chartData,
            renderedCategories: renderedCategories,
            renderedTotals: renderedTotals,
            optionalFields: library.optionalFields,
            renderedDescription: markdown.toHTML(list.description),
            baseUrl : config.get('deployUrl')};
        model = extend(model, templates);
        model.renderedTemplate = escape(Mustache.render(embedTemplate, model));
        res.send(Mustache.render(embedJTemplate, model));


    });
});


router.get("/csv/:id", function(req, res) {
    var id = req.params.id
    awesomeLog(req);

    if (!id) {
        res.status(400).send("No list specified!");
        return;
    }

    db.users.find({"library.lists.externalId": id}, function(err, users) {
        if (err) {
            res.status(500).send("An error occurred.");
            return;
        }

        if (!users.length) {
            res.status(400).send("Invalid list specified.");
            return;
        }

        var library = new Library();
        var list;

        if (!users[0] || typeof(users[0].library) == "undefined") {
            awesomeLog(req, "Undefined users[0].");
            res.status(500).send("Unknown error.");
        }

        library.load(users[0].library);
        for (var i in library.lists) {
            if (library.lists[i].externalId && library.lists[i].externalId == id) {
                library.defaultListId = library.lists[i].id;
                list = library.lists[i];
                break;
            }
        }

        var fullUnits = {oz: "ounce", lb: "pound", g: "gram", kg: "kilogram"};
        var out = "Item Name,Category,desc,qty,weight,unit\n";

        for (var i in list.categoryIds) {
            var category = library.getCategoryById(list.categoryIds[i]);
            for (var j in category.itemIds) {
                var categoryItem = category.itemIds[j];
                var item = library.getItemById(categoryItem.itemId);
                var temp = [item.name, category.name, item.description, categoryItem.qty, ""+MgToWeight(item.weight, item.authorUnit), fullUnits[item.authorUnit]];
                for (var k in temp) {
                    var field = temp[k];
                    if (k > 0) out += ",";
                    if (typeof(field) == "string") {
                        if (field.indexOf(",") > -1) out += "\"" + field.replace(/\"/g,"\"\"") + "\"";
                        else out += field;
                    } else out += field;
                }
                out += "\n";
            }
        }

        var filename = list.name;
        if (!filename) filename = id;
        filename = filename.replace(/[^a-z0-9\-]/gi, '_');

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment;filename="+filename+".csv")
        res.send(out);
    });
});

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
    var filePath = rootPath+"extIds.txt";

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

function awesomeLog(req, data) {
    if (!req) {
        console.log("awesome log but no req? why!?");
        return;
    }
    if (!data) {
        data = "";
    }
    if (data instanceof Object) {
        data = JSON.stringify(data);
    }

    var d = new Date();
    var time = d.toISOString();
    var ua = req.get("user-agent");

    console.log(time + " - " + req.ip + " - " + req.path + " - " + ua + " - " + data);
}

module.exports = router;