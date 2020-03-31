'use strict';var request = require('request');
var constants = require('./constants.js');
const URI = constants.URX;
module.exports = {
    call: async function(method, url_path, payload, token, cb){
        return new Promise((resolve, reject) => {
            var options = {
                method: method,
                url: URI + ''+ url_path,
                headers:{
                    'Content-Type':'application/json',
                    'belrium-token': token
                },
                body: JSON.stringify(payload)
            };
            function callback(error, response, body) {
                if(error) return reject(error);
                try {
                    // JSON.parse() can throw an exception if not valid JSON
                   resolve(JSON.parse(body));
               } catch(e) {
                   reject(e);
               }
            }
            request(options, callback);
        });
    }
}