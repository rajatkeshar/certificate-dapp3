var DappCall = require("../utils/DappCall");
var logger = require("../utils/logger");
var locker = require("../utils/locker");
var blockWait = require("../utils/blockwait");
var util = require("../utils/util");
var constants = require("../utils/constants");
var httpCall = require('../utils/httpCall.js');
var belriumJS = require('belrium-js');

app.route.post("/issuer/verifyViewRequest", async function(req){
    console.log("############### calling verify view request: ", req.query)

    try{
    app.sdb.lock("verifyViewRequest@"+req.query.assetId);
    }catch(err){
        return {
            message: "Same process in a block"
        }
    }

    var issuerDetails = await app.model.Issuer.findOne({
      condition: {
          email: req.query.email
      }
    });

    if(!issuerDetails) {
      return {
          message: "User must be issuer on dapps"
      }
    }

    var issuedCert = await app.model.Issue.findOne({
      condition: {
          transactionId: req.query.assetId  // transaction id in issue table is assetId
      }
    });

    if(!issuedCert) {
      return {
          message: "Asset does not exist"
      }
    }

    var requester = await app.model.Requester.findOne({
        condition: {
            assetId: req.query.assetId,
            requesterWalletAddress: req.query.requesterWalletAddress
        }
    });
    console.log("################### requester: ", requester)
    if(requester && !requester.ownerStatus.bool()) {
        return {
          message: "Request Pending From Owner End"
        }
    }

    if(requester && requester.ownerStatus.bool() && requester.issuerStatus.bool()) {
        return {
          message: "Request Already verified"
        }
    }

    console.log("constants.fees.viewRequest: ", constants.fees.verifyViewRequest);

    let options = {
        fee: String(constants.fees.verifyViewRequest),
        type: 1006,
        args: JSON.stringify([req.query.requesterWalletAddress, req.query.assetId])
    };
    let secret = req.query.secret;

    let transaction = belriumJS.dapp.createInnerTransaction(options, secret);

    console.log("############ transaction: ", transaction);
    let dappId = util.getDappID();

    let params = {
        transaction: transaction
    };

    console.log("registerResult data: ", params);
    var response = await httpCall.call('PUT', `/api/dapps/${dappId}/transactions/signed`, params);

    console.log("@@@@@@@@@@@@@@@@@@@@@@@ response: ", response);
    if(!response.success){
        return {
            message: JSON.stringify(response)
        }
    }

    await blockWait();

    return response
});

function strToBool(s) {
    // will match one and only one of the string 'true','1', or 'on' rerardless
    // of capitalization and regardless off surrounding white-space.
    //
    regex=/^\s*(true|1|on)\s*$/i

    return regex.test(s);
}

String.prototype.bool = function() {
    return strToBool(this);
};
