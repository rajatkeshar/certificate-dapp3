var DappCall = require("../utils/DappCall");
var mailCall = require("../utils/mailCall");
var logger = require("../utils/logger");
var locker = require("../utils/locker");
var blockWait = require("../utils/blockwait");
var util = require("../utils/util");
var defaultFee = require('../../../dappsConfig.json').defaultFee;
var addressUtils = require('../utils/address');



app.route.post("/issueTransactionCall", async function(req, res){
    await locker("issueTransactionCall@"+req.query.pid);
    logger.info("Entered /issueTransactionCall API");
    var result = await issueAsset(req);
    // if(!result.isSuccess) return result;
    // await blockWait();
    return result;
})

app.route.post("/issueTransactionCallMultiple", async function(req){
    await locker("issueTransactionCallMultiple@" + req.query.iid);
    logger.info("Entered /issueTransactionCallMultiple API");
    var results = [];
    for(i in req.query.pids){
        var input = {
            query: req.query
        }
        input.query.pid = req.query.pids[i];
        results.push({
            pid: req.query.pids[i],
            result: await issueAsset(input)
        });
    }

    await blockWait();

    return {
        results: results,
        isSuccess: true
    }
});

async function issueAsset(req){
    try{
    app.sdb.lock("finalIssueAsset@"+req.query.pid);
    }catch(err){
        return { isSuccess: false, message: "Same pid in a block" }
    }
    //Check the package
    var limit = await app.model.Issuelimit.findOne({ condition: { name: "issuelimit" } });
    if(!limit || limit.value <= 0 || limit.expirydate < new Date().getTime()) return { isSuccess: false, message: "No active package" }

    var transactionParams = {};
    var pid = req.query.pid;
    var issuer = await app.model.Issuer.findOne({
        condition: { iid: req.query.iid }
    });

    var issue = await app.model.Issue.findOne({
        condition: { pid: pid }
    });

    if(!issue) return { message: "Invalid Asset", isSuccess: false }

    if(issue.status === 'issued') return { message: "Asset already issued", isSuccess: false }

    if(issue.status === 'pending') return { message: "Asset not Authorized", isSuccess: false }

    if(issue.iid !== req.query.iid) return { message: "Invalid issuer", isSuccess: false }

    var employee = await app.model.Employee.findOne({
        condition: { empid: issue.empid }
    });
    if(!employee) return { message: "Invalid employee", isSuccess: false }

    // if(issue.status !== "authorized") return "Payslip not authorized yet";


    var balanceCredit = await creditBalance(req.query.secret, "finalIssue");
    if(!balanceCredit.isSuccess) return balanceCredit;

    var array = [employee.walletAddress, "payslip", JSON.parse(issue.data), issue.pid, balanceCredit.ownerBalance];

    transactionParams.args = JSON.stringify(array);
    transactionParams.type = 1003;
    transactionParams.fee = balanceCredit.fee;
    transactionParams.secret = req.query.secret;

    var response = await DappCall.call('PUT', "/unsigned", transactionParams, util.getDappID(),0);

    if(!response.success){
        revertOwnerBalance(req.query.secret, "finalIssue");
        return {
            isSuccess: false,
            message: JSON.stringify(response)
        }
    }
    issue.data = JSON.parse(issue.data);
    //var employee = await app.model.Employee.findOne({ condition: { empid: issue.empid } });
    var mailBody = {
        mailType: "issueCertificate",
        mailOptions: {
            userEmail: employee.email,
            //authoriserEmail: checkauth.email,
            issuerEmail: issuer.email,
            name: issue.data.degree,
            assetId: pid
        }
    }
    mailCall.call("POST", "", mailBody, 0);

    return {
        isSuccess: true,
        transactionId: response.transactionId
    }
}

app.route.post('/useSuperAdminsBalance', async function(req){
    var issuerAddress = addressUtils.generateBase58CheckAddress(util.getPublicKey(req.query.secret));
    var ownerAddress = app.custom.dappOwner;
    console.log("Issuer's Address: " + issuerAddress);
    console.log("Owner's Address: " + ownerAddress);
    var contractObjects = app.custom.contractObjects;
    var currentFee = app.getFee(contractObjects.addressTesting.type);
    if(!currentFee) currentFee = {
        min: defaultFee
    }

    console.log("The fee is: " + currentFee.min);

    var ownerBalance = await app.model.Balance.findOne({
        condition: {
            address: ownerAddress
        }
    });
    if(!ownerBalance) ownerBalance = {
        balance: '0'
    };

    var issuerBalance = await app.model.Balance.findOne({
        condition: {
            address: issuerAddress
        }
    });
    if(!issuerBalance) issuerBalance = {
        balance: '0'
    };

    console.log("Owner Address: " + ownerAddress + " Owner Balance: " + ownerBalance.balance);
    console.log("Issuer Address: " + issuerAddress + " Issuer Balance: " + issuerBalance.balance);

    app.balances.transfer('BEL', currentFee.min, ownerAddress, issuerAddress);

    await blockWait();

    var ownerBalance = await app.model.Balance.findOne({
        condition: {
            address: ownerAddress
        }
    });
    if(!ownerBalance) ownerBalance = {
        balance: '0'
    };

    var issuerBalance = await app.model.Balance.findOne({
        condition: {
            address: issuerAddress
        }
    });
    if(!issuerBalance) issuerBalance = {
        balance: '0'
    };

    console.log("Owner Address: " + ownerAddress + " Owner Balance: " + ownerBalance.balance);
    console.log("Issuer Address: " + issuerAddress + " Issuer Balance: " + issuerBalance.balance);
});

async function creditBalance(secret, contract){
    var spenderAddress = addressUtils.generateBase58CheckAddress(util.getPublicKey(secret));
    var ownerAddress = app.custom.dappOwner;
    var contractObjects = app.custom.contractObjects;
    var currentFee = app.getFee(contractObjects[contract].type);
    if(!currentFee) currentFee = {
        min: defaultFee
    }

    var ownerBalance = await app.model.Balance.findOne({
        condition: {
            address: ownerAddress
        }
    });
    if(!ownerBalance) ownerBalance = {
        balance: '0'
    };
    if(Number(ownerBalance.balance) < Number(currentFee.min)) return {
        isSuccess: false,
        message: "Owner doesn't have enough dapp balance"
    }

    app.balances.transfer('BEL', currentFee.min, ownerAddress, spenderAddress);

    await blockWait();

    return {
        isSuccess: true,
        ownerBalance: ownerBalance.balance,
        fee: currentFee.min
    }
}

async function revertOwnerBalance(secret, contract){
    var spenderAddress = addressUtils.generateBase58CheckAddress(util.getPublicKey(secret));
    var ownerAddress = app.custom.dappOwner;
    var contractObjects = app.custom.contractObjects;
    var currentFee = app.getFee(contractObjects[contract].type);
    if(!currentFee) currentFee = {
        min: defaultFee
    }
    app.balances.transfer('BEL', currentFee.min, spenderAddress, ownerAddress);

    return {
        isSuccess: true
    }
}
