window.fetchJson = (url, options) => {
    function parseJSON(response) {
        return new Promise((resolve) => response.json()
        .then((json) => resolve({
            status: response.status,
            ok: response.ok,
            json: json
        })));
    }

    return new Promise((resolve, reject) => {
        fetch(url, options)
        .then(parseJSON)
        .then((response) => {
            if (response.ok) {
                return resolve(response.json);
            }
            return reject(response);
        })
        .catch((error) => reject({
            error: error.message
        }));
  });
};

window.readCookie = function(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
};

window.createCookie = function(name,value,days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime()+(days*24*60*60*1000));
        var expires = "; expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
};

window.getElementIndex = function(node) {
    var index = 0;
    while ( (node = node.previousElementSibling) ) {
        index++;
    }
    return index;
};

window.arrayMove = function(inputArray, oldIndex, newIndex) {
    var array = inputArray.slice();
    var element = array[oldIndex];
    array.splice(oldIndex, 1);
    array.splice(newIndex, 0, element);
    return array;
};
