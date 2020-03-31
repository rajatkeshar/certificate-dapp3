var mysqlite3 = require('sqlite3');
var path = require('path');
var util = require('./utils/util');
var SuperDappCall = require("./utils/SuperDappCall");
var sleep = require('./utils/sleep');
var config = require('../../dappsConfig.json');
var constants = require('./utils/constants.js');
var centralServerCall = require("./utils/centralServerCall.js");

module.exports = async function () {
    console.log('enter dapp init');
    var contractObjects = {
        finalIssue: {
            type: 1003,
            name: "Final issue",
            location: 'payroll.issuePaySlip'
        },
        addressTesting: {
            type: 1004,
            name: "Testing Address",
            location: 'temp.addressTesting'
        },
        viewRequestBy3rdParty: {
            type: 1005,
            name: "View Request",
            location: 'requester.viewRequest'
        },
        verifyViewRequestByIssuer: {
            type: 1006,
            name: "Verify View Request By Issuer",
            location: 'issuer.verifyViewRequest'
        },
        verifyViewRequestByOwner: {
            type: 1007,
            name: "Verify View Request By Owner",
            location: 'owner.verifyViewRequest'
        }
    }
    for(i in contractObjects){
        app.registerContract(contractObjects[i].type, contractObjects[i].location);
    }
    app.setDefaultFee(config.defaultFee, 'BEL');

    var timeout = 0;
    do{
        try{
            var getFees = await SuperDappCall.call("POST", "/dapps/getTransactionFees", {
                dappid: util.getDappID()
            });
        } catch(err){
            console.log("Could not connect to superdapp: " + timeout++);
            if(timeout > 10) {
                console.log("Timed out connection to super dapp, registering contracts with default fee");
                break;
            }
            await sleep(5000);
        }
    }while(!getFees);

    if(getFees && getFees.isSuccess){
        app.custom.dappOwner = getFees.dappOwner;
        for(i in getFees.fee){
            app.registerFee(contractObjects[getFees.fee[i].contract].type, getFees.fee[i].transactionFee, 'BEL');
        }
    }

    console.log("This is the superuser's address: " + app.custom.dappOwner);

    app.custom.contractObjects = contractObjects;

    app.events.on('newBlock', (block) => {
        console.log('new block received', block.height)
    })

    app.sideChainDatabase = new mysqlite3.Database(path.join(__dirname, "blockchain.db"), (err) => {
        if (err) {
            throw err;
        }
        console.log('Connected to the blockchain database');
    });

    var settingExists =  app.model.Setting.exists({
        id: '0'
    });
    settingExists.then(function(data){
        if(!data)
            app.sdb.create('setting', {
                id: '0',
                fields: JSON.stringify({
                    name: "Name",
                    id: "ID",
                    year: "Year",
                    degree: "Degree",
                    department: "Department"
                }),
                identity: JSON.stringify({
                    "Aadhar Card": "AdharNumber"
                })
            })
    })

    var limitExists = await app.model.Issuelimit.exists({
        name: "issuelimit"
    });
    if(!limitExists){
        var response = await centralServerCall.call("POST", "/getUser", {
            email: getFees.email
        });
        app.sdb.create("issuelimit", {
            name: "issuelimit",
            value: response.totalcerts,
            expirydate: response.expirydate
        });
    }
}
