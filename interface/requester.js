var DappCall = require("../utils/DappCall");
var logger = require("../utils/logger");
var locker = require("../utils/locker");
var blockWait = require("../utils/blockwait");
var util = require("../utils/util");
var constants = require("../utils/constants");
var httpCall = require('../utils/httpCall');
var address = require('../utils/address');
var belriumJS = require('belrium-js');

app.route.post("/requester/viewRequest", async function(req){
    console.log("############### calling view request: ", req.query)

    try{
    app.sdb.lock("viewRequest@"+req.query.assetId);
    }catch(err){
        return {
            message: "Same process in a block"
        }
    }

    var issuedCert = await app.model.Issue.findOne({
      condition: {
          transactionId: req.query.assetId
      }
    });

    if(!issuedCert) {
      return {
          message: "Asset does not exist"
      }
    }
    console.log("address.generateBase58CheckAddress(util.getPublicKey(req.query.secret)): ", address.generateBase58CheckAddress(util.getPublicKey(req.query.secret)));
    var requester = await app.model.Requester.findOne({
        condition: {
            assetId: req.query.assetId,
            requesterWalletAddress: address.generateBase58CheckAddress(util.getPublicKey(req.query.secret))
        }
    });
    console.log("################### requester: ", requester)
    if(requester && requester.ownerStatus.bool() && requester.issuerStatus.bool()) {
        return {
          message: "Request Already Authorized"
        }
    }

    if(requester && !requester.ownerStatus.bool()) {
        return {
          message: "Already Requested"
        }
    }

    if(requester && requester.ownerStatus.bool() && !requester.issuerStatus.bool()) {
        return {
          message: "Request Pending From issuer End."
        }
    }

    console.log("constants.fees.viewRequest: ", constants.fees.viewRequest);

    let options = {
        fee: String(constants.fees.viewRequest),
        type: 1005,
        args: JSON.stringify([req.query.assetId])
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

app.route.get("/requester/list/assets", async function(req) {
    console.log("############### calling list asset request: ", req.query)

    var requester = await app.model.Requester.findAll();

    if(!requester) {
        return {
          message: "No details found"
        }
    }

    return {
        message: "Asset list",
        data: requester
    }
});

app.route.post("/requester/asset/get", async function(req) {
    console.log("############### calling list asset request: ", req.query.assetId)

    var requester = await app.model.Requester.findOne({
      condition: {
          assetId: req.query.assetId,
          requesterWalletAddress: req.query.address
      }
    });

    if(!requester) {
        return {
          message: "No details found"
        }
    }

    if(!requester.ownerStatus.bool()) {
      return {
        message: "You Are Not Authorized To View This Asset, Pending From Owner End"
      }
    }

    if(!requester.issuerStatus.bool()) {
      return {
        message: "You Are Not Authorized To View This Asset, Pending From Issuer End"
      }
    }

    var issuedCert = await app.model.Issue.findOne({
      condition: {
          transactionId: req.query.assetId  // transaction id in issue table is assetId
      }
    });

    return {
        message: "Asset details",
        data: issuedCert
    }
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
