var DappCall = require("../utils/DappCall");
var logger = require("../utils/logger");
var locker = require("../utils/locker");
var blockWait = require("../utils/blockwait");
var util = require("../utils/util");
var constants = require("../utils/constants");
var httpCall = require('../utils/httpCall');
var address = require('../utils/address');
var belriumJS = require('belrium-js');
var mailCall = require("../utils/mailCall");
var _ = require("lodash");

app.route.post("/requester/viewRequest", async function(req){
    console.log("############### calling view request: ", req.query)

    if(!req.query.countryCode) return { message: "missing params countryCode" };

    //try { app.sdb.lock("viewRequest@"+req.query.assetId);} catch(err){ return { message: "Same process in a block" } }

    var issuedCert = await app.model.Issue.findOne({ condition: { transactionId: req.query.assetId } });
    if(!issuedCert) return { message: "Asset does not exist" }

    var employee = await app.model.Employee.findOne({ condition: { empid: issuedCert.empid }});
    if(employee.walletAddress == address.generateBase58CheckAddress(util.getPublicKey(req.query.secret))) return { message: "You can not make view request on own asset"}
    console.log("address.generateBase58CheckAddress(util.getPublicKey(req.query.secret)): ", address.generateBase58CheckAddress(util.getPublicKey(req.query.secret)));

    var requester = await app.model.Requester.findOne({
        condition: {
            assetId: req.query.assetId,
            requesterWalletAddress: address.generateBase58CheckAddress(util.getPublicKey(req.query.secret)) + req.query.countryCode
        }
    });
    console.log("################### requester: ", requester)
    if(requester && requester.ownerStatus.bool() && requester.issuerStatus.bool()) return { message: "Request Already Authorized" }

    if(requester && !requester.ownerStatus.bool()) return { message: "Already Requested" }

    if(requester && requester.ownerStatus.bool() && !requester.issuerStatus.bool()) return { message: "Request Pending From issuer End." }

    let options = {
        fee: String(constants.fees.viewRequest),
        type: 1005,
        args: JSON.stringify([req.query.assetId, req.query.countryCode])
    };
    let secret = req.query.secret;
    let transaction = belriumJS.dapp.createInnerTransaction(options, secret);
    let dappId = util.getDappID();

    let params = { transaction: transaction };

    console.log("view request data: ", params);
    var response = await httpCall.call('PUT', `/api/dapps/${dappId}/transactions/signed`, params);
    if(!response.success){ return { message: JSON.stringify(response) } }

    var issuer = await app.model.Issuer.findOne({ condition: { iid: issuedCert.iid } });
    var owner = await app.model.Employee.findOne({ condition: { empid: issuedCert.empid } });
    var mailBody = {
        mailType: "requestCertificate",
        mailOptions: {
            requesterEmail: employee.email,
            ownerEmail: owner.email,
            issuerEmail: issuer.email,
            name: issuedCert.data.degree,
            assetId: req.query.assetId
        }
    }
    mailCall.call("POST", "", mailBody, 0);
    return response
});

app.route.post("/requester/authorizeby/issuer", async function(req){
    console.log("############### calling view request: ", req.query)

    if(!req.query.countryCode) return { message: "missing params countryCode" };

    var issuedCert = await app.model.Issue.findOne({ condition: { transactionId: req.query.assetId } });
    if(!issuedCert) return { message: "Asset does not exist" }

    var requester = await app.model.Requester.findOne({ condition: { assetId: req.query.assetId, requesterWalletAddress: address.generateBase58CheckAddress(util.getPublicKey(req.query.secret)) + req.query.countryCode } });
    if(requester && requester.ownerStatus.bool() && requester.isAuthorizeByIssuer.bool()) return { message: "Request Already processed" }

    let options = {
        fee: String(constants.fees.viewRequest),
        type: 1014,
        args: JSON.stringify([req.query.assetId, req.query.countryCode])
    };
    let secret = req.query.secret;
    let transaction = belriumJS.dapp.createInnerTransaction(options, secret);
    let dappId = util.getDappID();

    let params = { transaction: transaction };

    console.log("view request data: ", params);
    var response = await httpCall.call('PUT', `/api/dapps/${dappId}/transactions/signed`, params);

    if(!response.success){
        return { message: JSON.stringify(response) }
    }
    return response
});

app.route.get("/requester/list/assets", async function(req) {
    var data = [];
    var issuedCert = await app.model.Issue.findAll({
      condition: {status: "issued"}
    });
    issuedCert.map(cert=> {
      assetId = cert.transactionId
      details = JSON.parse(cert.data);
      data.push({assetId: assetId, name: details.name, degree: details.degree})
    });
    return {
        message: "Asset list",
        data: data
    }
});

app.route.post("/requester/track/assets/status", async function(req) {
    var requester = await app.model.Requester.findAll({ condition: { requesterWalletAddress: req.query.address } });
    console.log("requester: ", requester);
    if(!requester || requester.length == 0) { return { message: "No details found" } }
    await new Promise((resolve, reject) => {
      requester.map(async(obj, index) => {
        var issue = await app.model.Issue.findOne({
          condition: { transactionId: obj.assetId }
        });
        var issuer = await app.model.Issuer.findOne({
          condition: { iid: issue.iid }
        });
        var owner = await app.model.Employee.findOne({
          condition: { empid: issue.empid }
        });
        if(owner) {
          requester[index].owner = {
            name: owner.name,
            email: owner.email,
            department: owner.department
          }
        }
        if(issuer) {
          requester[index].issuer = {
            email: issuer.email
          }
        }
        if(index == requester.length-1) {
            resolve();
        }
      })
    })
    if(!requester.length) {
      return {message: "detail not found"};
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
    console.log("requester: ", requester);
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

    if(!requester.issuerStatus.bool() && requester.isAuthorizeByIssuer.bool()) {
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
