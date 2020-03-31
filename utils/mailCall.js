'use strict';var request = require('request');
var constants = require('./constants.js');
const URI = constants.MRI;
module.exports = {
    call: async function(method, url_path, payload, cb){
        return new Promise((resolve, reject) => {
            var options = {
                method: method,
                url: URI + '' + url_path,
                headers:{
                    'Content-Type':'application/json',
                    'magic': '594fe0f3',
             'version': ''
                },
                body: JSON.stringify(payload)
            };
            function callback(error, response, body) {
                if(error) return reject(error);
                try {
                    console.log("from callback in mailcall.js: " + body);
                    // JSON.parse() can throw an exception if not valid JSON
                   resolve(JSON.parse(body));
               } catch(e) {
                   //reject(e);
                   console.log(e);
                   resolve({isSuccess: true});
               }
            }
            request(options, callback);
        });
    }
}