var DappCall = require("../utils/DappCall");
var logger = require("../utils/logger");
var locker = require("../utils/locker");
var blockWait = require("../utils/blockwait");
var util = require("../utils/util");
var constants = require("../utils/constants");
var httpCall = require('../utils/httpCall.js');
var mailCall = require("../utils/mailCall");
var belriumJS = require('belrium-js');

app.route.post("/issuer/verifyViewRequest", async function(req){
    console.log("############### calling verify view request: ", req.query)
    if(!req.query.countryCode) return { message: "missing params countryCode" };

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
    issuedCert.data = JSON.parse(issuedCert.data);
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
        args: JSON.stringify([req.query.requesterWalletAddress, req.query.assetId, req.query.countryCode])
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

    var issuer = await app.model.Issuer.findOne({ condition: { iid: issuedCert.iid } });
    var requesterDetails = await app.model.Employee.findOne({ condition: { walletAddress: req.query.requesterWalletAddress } });
    var owner = await app.model.Employee.findOne({ condition: { empid: issuedCert.empid } });
    var mailBody = {
        mailType: "verifyCertificate",
        mailOptions: {
            requesterEmail: requesterDetails.email,
            ownerEmail: owner.email,
            issuerEmail: issuer.email,
            name: issuedCert.data.degree,
            assetId: req.query.assetId
        }
    }
    mailCall.call("POST", "", mailBody, 0);
    return response
});

function strToBool(s) {
    // will match one and only one of the string 'true','1', or 'on' rerardless
    // of capitalization and regardless off surrounding white-space.
    //
    regex=/^\s*(true|1|on)\s*$/i

    return regex.test(s);
}

app.route.post("/issuer/track/assets/status", async function(req) {
  var issuer = await app.model.Issuer.findOne({
    condition: { email: req.query.email }
  });
  if(!issuer) {
    return {message: "issuer not found"}
  }
  var issue = await app.model.Issue.findAll({
    condition: { iid: issuer.iid }
  });

  await new Promise((resolve, reject) => {
    data = [];
    issue.map(async(obj, index) => {
      var requester = await app.model.Requester.findAll({
        condition: {
            assetId: obj.transactionId,
            ownerStatus: "true",
            issuerStatus: "false"
        }
      });

      requester.forEach((item, i) => {
        if(item.initBy === "requester" || item.isAuthorizeByIssuer == "true") {
          data.push(item);
        }
      });

      if(index == issue.length-1) {
          resolve();
      }
    })
  })
  if(!data.length) {
    return {message: "no request found"};
  }
  await new Promise((resolve, reject) => {
    data.map(async(obj, index) => {
      var issue = await app.model.Issue.findOne({
        condition: { transactionId: obj.assetId }
      });
      var owner = await app.model.Employee.findOne({
        condition: { empid: issue.empid }
      });
      if(owner) {
        data[index].owner = {
          name: owner.name,
          email: owner.email,
          department: owner.department
        }
      }
      if(issuer) {
        data[index].issuer = {
          email: issuer.email
        }
      }
      if(index == data.length-1) {
          resolve();
      }
    })
  })

  return {
      message: "Asset list",
      data: data
  }
});

String.prototype.bool = function() {
    return strToBool(this);
};
