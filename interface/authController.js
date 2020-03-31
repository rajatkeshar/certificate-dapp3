var config = require("../config.json");
var jwt = require('jsonwebtoken');
var logger = require("../utils/logger");


module.exports.getJwt = async function(email){
    // create a token
    var token = jwt.sign({ id: email, timestamp: new Date().getTime() }, config.tokenKey, {
        expiresIn: 86400 // expires in 24 hours
      });
    return token;
}