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

module.exports = awesomeLog;