var SuperDappCall = require("../utils/SuperDappCall")
var DappCall = require("../utils/DappCall");



app.route.post('/generateEmployees', async function(req, cb){
    var count = await app.model.Count.findOne({
        condition: {
            id: 0
        }
    });

    var prefix = req.query.prefix;

    for(var i = count.empid+1; i <= count.empid+req.query.count; i++){
        var creat = {
            email: prefix + "PEEmail" + i + "@yopmail.com",
            empid: prefix + "Employee" + i,
            name: prefix + "PEName" + i,
            designation: prefix + "PEmplDesignation" + i,
            bank: prefix + "PEBank" + i,
            accountNumber: prefix + "PEAccountNumber" + i,
            pan: prefix + "PEPan" + i,
            salary: Math.floor(Math.random() * 50000 + 10000),
            walletAddress: prefix + "PEAddress" + i
        }

        console.log("About to make a row");
        app.logger.log("LOLOLOLOLLLOOLOLOLOLOLOLOL");

        app.sdb.create('employee', creat);

        var mapEntryObj = {
            address: prefix + "PEAddress" + i,
            dappid: req.query.dappid
        }
        var mapcall = await SuperDappCall.call('POST', '/mapAddress', mapEntryObj);
        app.sdb.update('count', {empid: count.empid + req.query.count}, {id: 0});
    }
});

app.route.post('/generateAndIssuePayslips', async function(req, cb){
    var employees = await app.model.Employee.findAll({});
    var prefix = req.query.prefix
    for ( i in employees){
        console.log("employee mail is: " + employees[i].email);
        for(var j = 1; j <= 12; j++){
            var payslip = {
                pid: prefix + "PPId" + (i+1)*j,
                email: prefix + employees[i].email,
                empid: prefix + employees[i].empid,
                name: prefix + employees[i].name,
                employer: prefix + "PPEmployer",
                month: prefix + "PPMonth" + j,
                year: prefix + "PPYear",
                designation: prefix + employees[i].designation,
                bank: prefix + employees[i].bank,
                accountNumber: prefix + employees[i].accountNumber,
                pan: prefix + employees[i].pan,
                basicPay: Math.floor(Math.random() * 50000 + 10000),
                hra: Math.floor(Math.random() * 2000 + 1000),
                lta: Math.floor(Math.random() * 2000 + 1000),
                ma: Math.floor(Math.random() * 2000 + 1000),
                providentFund: Math.floor(Math.random() * 2000 + 1000),
                professionalTax: Math.floor(Math.random() * 2000 + 1000),
                grossSalary: Math.floor(Math.random() * 50000 + 10000),
                totalDeductions: Math.floor(Math.random() * 10000 + 1000),
                netSalary: Math.floor(Math.random() * 50000 + 10000),
                timestamp: prefix + new Date().getTime().toString()
            };
            app.sdb.create('payslip', payslip);

            app.sdb.create('issue', {
                pid: payslip.pid,
                iid: 1,
                hash: prefix + "PPHash" + i*j,
                sign: prefix + "PPSign" + i*j,
                publickey: prefix + "-",
                timestampp: new Date().getTime().toString(),
                status: "issued",
                count: 10,
                empid: employees[i].empid,
                transactionId: '-'
            });

            var args = "[\"" + employees[i].walletAddress + "\"," + "\"payslip\"";
            for(k in payslip){
                args += ",\"" + payslip[k] + "\"";
            }
            args += "]";

            var transactionParams = {};
            transactionParams.args = args;
            transactionParams.type = 1003;
            transactionParams.fee = req.query.fee;
            transactionParams.secret = req.query.secret;
            transactionParams.senderPublicKey = req.query.senderPublicKey;

            //console.log(JSON.stringify(transactionParams));

            var response = await DappCall.call('PUT', "/unsigned", transactionParams, req.query.dappid,0);
            console.log("Result is: " + JSON.stringify(response));
        }
    }
})
