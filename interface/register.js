var util = require("../utils/util.js");
var config = require("../../../dappsConfig.json");
var SwaggerCall = require("../utils/SwaggerCall");
var SuperDappCall = require("../utils/SuperDappCall")
var TokenCall = require("../utils/TokenCall");
var register = require("../interface/register");
var registrations = require("../interface/registrations");
var authJwt = require("../interface/authController");
var mailCall = require("../utils/mailCall");
var SwaggerCall = require("../utils/SwaggerCall");
var logger = require("../utils/logger");
var locker = require("../utils/locker");
var blockWait = require("../utils/blockwait");



// For the employee table,
// GET call
// inputs: limit, offset
// outputs: empid, name, designations
app.route.post('/employees', async function(req, cb){

    logger.info("Entered /employees API");

    var total = await app.model.Employee.count({
        deleted: '0'
    });
    var options = {
        condition: {
            deleted: '0'
        },
        fields: ['empid', 'name'],
        limit: req.query.limit,
        offset: req.query.offset
    }

    var result = await app.model.Employee.findAll(options);

    return {
        total: total,
        employees: result
    };
})

// For issue auto-fill,
// GET call
// inputs: empid
// outputs: email, empid, name, designation, actualsalary
app.route.post('/employeeData', async function(req,cb){
    logger.info("Entered /employeeData API");

    var options = {
        condition: {
            empid: req.query.empid,
            deleted: '0'
        }
    }

    var result = await app.model.Employee.findOne(options);
    if(!result) return {
        message: "Recipient not found",
        isSuccess: false
    }

    return {
        employee: result,
        isSuccess: true
    };
})

async function verifyPayslip(req, cb){
    logger.info("Entered verifyPaysli p API");
    var hash = util.getHash(req.query.data);
    var base64hash = hash.toString('base64');

    console.log("Verify payslip string: " + req.query.data);
    console.log("Verify payslip hash: " + base64hash);

    var result = await app.model.Issue.findOne({
        condition: {hash: base64hash}
    });
    if(!result) return {
        message: "Hash not found",
        isSuccess: false
    }

    var sign = new Buffer(result.sign, 'base64');

    var issuer = await app.model.Issuer.findOne({
        condition: {
            iid: result.iid
        }
    });
    if(!issuer) return {
        message: "Invalid Issuer",
        isSuccess: false
    }

    var publickey = new Buffer(issuer.publickey, 'hex');

    if(!util.Verify(hash, sign, publickey)) return {
        message: "Wrong Issuer Signature",
        isSuccess: false
    }

    if(result.status !== "issued") return {
        message: "Payslip not yet issued or authorized",
        isSuccess: false
    }

    var signatures = await app.model.Cs.findAll({
        condition: {
            pid: result.pid
        }
    });

    for(i in signatures){
        let authorizer = await app.model.Authorizer.findOne({
            condition: {
                aid: signatures[i].aid
            }
        });
        if(!authorizer) {
            authorizer = {
                aid: "Invalid Authorizer"
            }
        }
        if(!util.Verify(hash, new Buffer(signatures[i].sign, 'base64'), new Buffer(signatures[i].publickey, 'hex'))) return {
            message: "Wrong Authorizer signature of Authorizer ID: " + authorizer.aid,
            isSuccess: false
        }
    }

    var transaction = await app.model.Transaction.findOne({
        id: result.transactionId
    });
    delete result.transactionId;
    result.transaction = transaction;
    result.issuedBy = issuer.email;
    result.isSuccess = true;
    return result;

}

app.route.post("/payslips/verify", verifyPayslip);

module.exports.getToken = async function(req, cb){
    logger.info("Entered /getToken API");
    var options = {
        email: config.token.email,
        password: config.token.password,
        totp: config.token.totp
    }

    var response = await SwaggerCall.call('POST','/api/v1/login', options);

    if(!response) return "-1";
    if(!response.isSuccess) return "0";

    return  response.data.token;

}

app.route.post('/getToken', module.exports.getToken)

//On issuer dashboard to display confirmed payslips which are confirmed by all authorizers 
//GET call
//inputs:month and year
//outpu: pays array which contains the confirmed payslips.
app.route.post('/payslip/confirmedIssues',async function(req,cb){
    logger.info("Enterd /payslip/confirmedIssues API");

    var total = await app.model.Issue.count({
        iid: req.query.iid,
        status: 'authorized'
    });
    var confirmedIssues = await app.model.Issue.findAll({
        condition: {
            iid: req.query.iid,
            status: 'authorized'
        },
        limit: req.query.limit,
        offset: req.query.offset
    });
    
    return {
        total: total,
        confirmedPayslips: confirmedIssues
    }
    
})

app.route.post('/payslip/initialIssue',async function(req,cb){

    await locker("/payslip/initialIssue");

    logger.info("Entered /payslip/initialIssue API");

    // Check Employee
    var employee = await app.model.Employee.findOne({
        condition: {
           empid: req.query.empid,
           deleted: "0"
        }
   });
   if(!employee) return {
       message: "Invalid Recipient",
       isSuccess: false
    }
    var identity = JSON.parse(employee.identity);
   
    var timestamp = new Date().getTime();

     issuerid=req.query.issuerid;
     secret=req.query.secret;
     var publickey = util.getPublicKey(secret);
     var issuer = await app.model.Issuer.findOne({
         condition:{
             iid: req.query.issuerid,
             deleted: "0"
         }
     });
     if(!issuer) return {
         message: "Invalid Issuer",
         isSuccess: false
     }
     var department = await app.model.Department.findOne({
         condition: {
             name: employee.department
         }
     });

     var issuerDepartmentExists = await app.model.Issudept.findOne({
         condition: {
             iid: issuer.iid,
             did: department.did,
             deleted: '0'
         }
     });

     if(!issuerDepartmentExists) return {
         isSuccess: false,
         message: "Issuer and recipient department doesn't match"
     }

     if(!req.query.data) return {
         isSuccess: false,
         message: "Please provide the asset object"
     }

     req.query.data.identity = identity;
     
    // Check Payslip already issued

    var payslipString = JSON.stringify(req.query.data);

    var duplicateCheck = await app.model.Issue.findOne({
        condition: {
            data: payslipString
        }
    });
    if(duplicateCheck) return {
        isSuccess: false,
        message: "An issue with the same details already exists with ID: " + duplicateCheck.pid
    }

    var hash = util.getHash(payslipString);
    var sign = util.getSignatureByHash(hash, secret);
    var base64hash = hash.toString('base64');
    var base64sign = sign.toString('base64');
    
    var issue = {
        pid:String(Number(app.autoID.get('issue_max_pid')) + 1),
        iid:issuerid,
        hash: base64hash,
        sign: base64sign,
        publickey:publickey,
        timestampp:timestamp,
        status:"pending",
        empid: employee.empid,
        transactionId: '-',
        did: department.did
    }

    issue.data = payslipString;

    var level = 1;
    while(1){
        if(level > department.levels){
            issue.status = 'authorized',
            level--;
            break;
        }
        var authLevelCount = await app.model.Authdept.count({
            did: department.did,
            level: level,
            deleted: '0'
        });

        if(authLevelCount) {
            break;
        }

        level++;
    }
    issue.authLevel = level;

    app.sdb.create("issue", issue);
    if(issuer.publickey === '-'){
        app.sdb.update('issuer', {publickey: publickey}, {iid:issuerid});
    }

    app.sdb.create('template', {
        pid: issue.pid,
        template: req.query.template
    });
    
    app.autoID.increment('issue_max_pid');

    await blockWait(); 

    return {
        message: "Asset initiated",
        isSuccess: true
    }
});

app.route.post('/authorizers/pendingSigns',async function(req,cb){
    logger.info("Entered /authorizers/pendingSigns API");
        var checkAuth = await app.model.Authorizer.findOne({
            condition:{
                aid: req.query.aid,
                deleted: '0'
            }
        });
        if(!checkAuth) return {
            message: "Invalid Authorizer",
            isSuccess: false
        }

        var authdepts = await app.model.Authdept.findAll({
            condition: {
                aid: checkAuth.aid,
                deleted: '0'
            }
        });

        var pendingSignatureIssues = [];
        var total = 0;
        var iterator = 0;
        if(!req.query.limit) req.query.limit = Number.POSITIVE_INFINITY;
        if(!req.query.offset) req.query.offset = 0

        // Just mapping code of departments and issuers
        var departments = await app.model.Department.findAll();
        var departmentsMapping = {};
        for(i in departments){
            departmentsMapping[departments[i].did] = {
                name: departments[i].name,
                levels: departments[i].levels
            }
        }

        var issuers = await app.model.Issuer.findAll({
            fields: ['iid', 'email']
        })
        var issuerMapping = {};
        for(let i in issuers){
            issuerMapping[issuers[i].iid] = issuers[i].email
        }
        // Just mapping code of departments and issuers

        for(let i in authdepts){
            var issues = await app.model.Issue.findAll({
                condition: {
                    status: "pending",
                    did: authdepts[i].did,
                    authlevel: authdepts[i].level
                }
            });

            for(let j in issues){
                var signed = await app.model.Cs.exists({
                    aid: checkAuth.aid,
                    pid: issues[j].pid
                });
                if(!signed){
                    total++;
                    if(iterator++ < req.query.offset) continue;
                    if(pendingSignatureIssues.length >= req.query.limit) continue;
                    var employee = await app.model.Employee.findOne({
                        condition: {
                            empid: issues[j].empid
                        }
                    });
                    issues[j].receipientEmail = employee.email;
                    issues[j].receipientName = employee.name;
                    issues[j].totalLevels = departmentsMapping[issues[j].did].levels;
                    issues[j].departmentName = departmentsMapping[issues[j].did].name;
                    issues[j].issuerEmail = issuerMapping[issues[j].iid];

                    pendingSignatureIssues.push(issues[j]);
                }
            }
        }

        return {
            total: total,
            result: pendingSignatureIssues,
            isSuccess: true
        }
});

app.route.post('/payslip/getPayslip', async function(req, cb){
    logger.info("Entered /payslip/getPayslip API");
    var payslip = await app.model.Issue.findOne({
        condition: {
            pid: req.query.pid
        }
    });
    if(!payslip) return {
        isSuccess: false,
        message: "Invalid Asset ID"
    }

    return {
        isSuccess: true,
        result: payslip
    }
})

app.route.post('/authorizer/authorize',async function(req,cb){
    logger.info("Entered /authorizer/authorize API");
    await locker("Authorization@"+req.query.pid);
    var result = await authorizerSign(req);
    if(!result.isSuccess) return result;
    await blockWait();
    return result;
})

app.route.post('/authorizer/authorizeMultiple', async function(req){
    await locker("authorizer/authorizeMultiple@" + req.query.aid);
    logger.info("Entered /authorizer/authorizeMultiple API");
    var results = [];
    for(i in req.query.pids){
        var input = {
            query: req.query
        }
        input.query.pid = req.query.pids[i];
        results.push({
            pid: req.query.pids[i],
            result: await authorizerSign(input)
        });
    }

    await blockWait();
    
    return {
        results: results,
        isSuccess: true
    }
})

async function authorizerSign(req){
    var secret = req.query.secret;
    var authid = req.query.aid;
    var pid=req.query.pid;
    try{
    app.sdb.lock("authorizerSign@"+req.query.pid);
    }catch(err){
        return {
            isSuccess: false,
            message: "Same pid in a block"
        }
    }
        // Check Authorizer
    var publickey = util.getPublicKey(secret);
    var checkauth = await app.model.Authorizer.findOne({
        condition:{
            aid: authid,
            deleted: '0'
        }
    });
    if(!checkauth) return {
        message: "Invalid Authorizer",
        isSuccess: false
    }

    var issue = await app.model.Issue.findOne({
        condition: {
            pid: pid
        }
    });
    if(!issue) return {
        message: "Invalid issue",
        isSuccess: false
    }

    if(issue.status !== "pending") return {
        message: "Issue is not pending",
        isSuccess: false
    }

    var authdept = await app.model.Authdept.findOne({
        condition: {
            aid: authid,
            did: issue.did,
            level: issue.authLevel
        }
    });
    if(!authdept) return {
        isSuccess: false,
        message: "Authorizer is not supposed to sign this payslip"
    }

    var check = await app.model.Cs.findOne({
        condition: {
            pid: pid,
            aid: authid
        }
    });
    if(check) return {
        message: "Already authorized",
        isSuccess: false
    }

    var issuer = await app.model.Issuer.findOne({
        condition: {
            iid: issue.iid
        }
    });
    if(!issuer) return {
        message: "Invalid issuer",
        isSuccess: false
    }

    var hash = util.getHash(issue.data);
    var base64hash = hash.toString('base64');
    console.log("issue.hash: " + issue.hash);
    console.log("base64hash: " + base64hash);
    if(issue.hash !== base64hash) return {
        message: "Hash doesn't match",
        isSuccess: false
    }
    var base64sign = (util.getSignatureByHash(hash, secret)).toString('base64');

    if(checkauth.publickey === '-'){
        app.sdb.update('authorizer', {publickey: publickey}, {aid: authid});
    }

    app.sdb.create('cs', {
        pid:pid,
        aid:authid,
        sign: base64sign,
        publickey: publickey,
        timestampp: new Date().getTime(),
        deleted: '0'
    });

    var department = await app.model.Department.findOne({
        condition: {
            did: issue.did
        }
    });

    let level = issue.authLevel + 1;
    while(1){
        if(level > department.levels){
            app.sdb.update('issue', {status: 'authorized'}, {pid: issue.pid});
            level--;
            break;
        }
        var authLevelCount = await app.model.Authdept.count({
            did: issue.did,
            level: level,
            deleted: '0'
        });

        if(authLevelCount) {
            break;
        }

        level++;
    }
    app.sdb.update('issue', {authLevel: level}, {pid: issue.pid});

    var activityMessage = checkauth.email + " has authorized payslip " + pid + " which was issued by " + issuer.email;
    app.sdb.create('activity', {
        activityMessage: activityMessage,
        pid: pid,
        timestampp: new Date().getTime(),
        atype: 'payslip'
    });

    return {
        isSuccess: true
    };
}

app.route.post('/authorizer/reject',async function(req,cb){
    logger.info("Entered /authorizer/reject API");
    await locker('/authorizer/reject@' + req.query.aid);
    var result = await authorizerReject(req);
    if(!result.isSuccess) return result;
    await blockWait();
    return result;
});

app.route.post('/authorizer/rejectMultiple', async function(req){
    await locker("/authorizer/rejectMultiple@" + req.query.aid);
    logger.info("Entered /authorizer/rejectMultiple API");
    var results = [];
    for(i in req.query.pids){
        var input = {
            query: req.query
        }
        input.query.pid = req.query.pids[i];
        results.push({
            pid: req.query.pids[i],
            result: await authorizerReject(input)
        });
    }

    await blockWait();

    return {
        results: results,
        isSuccess: true
    }
})

async function authorizerReject(req){
    try{
    app.sdb.lock("authorizerReject@"+req.query.pid);
    }catch(err){
        return {
            isSuccess: false,
            message: "Same pid in a block"
        }
    }
    var authorizer = await app.model.Authorizer.findOne({
        condition: {
            aid: req.query.aid
        }
    });
    if(!authorizer) return {
        isSuccess: false,
        message: "Invalid Authorizer"
    };

    var issue = await app.model.Issue.findOne({
        condition: {
            pid: req.query.pid,
            status: 'pending'
        }
    });
    if(!issue) return {
        isSuccess: false,
        message: "Asset not pending"
    }

    var issuer = await app.model.Issuer.findOne({
        condition: {
            iid: issue.iid
        }
    })

    var pid = req.query.pid;
    var message = req.query.message;
    var timestampp = new Date().getTime();
    app.sdb.update('issue', {status: 'rejected'}, {pid: pid});
    app.sdb.create('rejected', {
        pid: pid,
        aid: req.query.aid,
        iid: issue.iid,
        reason: message,
        timestampp: timestampp
    });

    var mailBody = {
        mailType: "sendRejected",
        mailOptions: {
            to: [issuer.email],
            authorizerEmail: authorizer.email, 
            message: message,
            payslip: JSON.stringify(issue.data)
        }
    }

    mailCall.call("POST", "", mailBody, 0);

    var activityMessage = authorizer.email + " has rejected payslip " + pid + " which was issued by " + issuer.email;
    app.sdb.create('activity', {
        activityMessage: activityMessage,
        pid: pid,
        timestampp: timestampp,
        atype: 'payslip'
    });

    return {
        isSuccess: true
    }
}

app.route.post('/searchEmployee', async function(req, cb){
    logger.info("Entered /searchEmployee API");
    var condition = {};
    condition[req.query.searchBy] = {
        $like: "%" + req.query.text + "%"
    };
    try{
        var total = await app.model.Employee.count(condition);
        var result = await app.model.Employee.findAll({
            condition: condition,
            limit: req.query.limit,
            offset: req.query.offset
        });
    }catch(err){
        logger.error("searchBy parameter not an Employee table column");
        return {
            message: "searchBy parameter not an Employee table column",
            isSuccess: false
        }
    }
    return {
        total: total,
        result: result,
        isSuccess: true
    }
})

app.route.post("/sharePayslips", async function(req, cb){
    logger.info("Entered /sharePayslips API");
    var employee = await app.model.Employee.findOne({
        condition: {
            empid: req.query.empid
        }
    });
    var mailBody = {
        mailType: "sendShared",
        mailOptions: {
            to: [req.query.email],
            name: employee.name,
            pids: req.query.pids,
            dappid: req.query.dappid
        }
    }

    mailCall.call("POST", "", mailBody, 0);
})

app.route.post("/registerEmployee", async function(req, cb){
    await locker("/registerEmployee");

    logger.info("Entered /registerEmployee API");

    var countryCode = req.query.countryCode;
    var email = req.query.email;
    var lastName = req.query.lastName;
    var name = req.query.name;
    var uuid = req.query.empid;
    var extra = JSON.stringify(req.query.extra);
    var identity = JSON.stringify(req.query.identity);
    var dappid = util.getDappID();
    var token = req.query.token;
    var groupName = req.query.groupName;
    var iid = req.query.iid

    var issuer = await app.model.Issuer.findOne({
        condition: {
            iid: iid,
            deleted: '0'
        }
    });

    if(!issuer) return {
        message: "Invalid issuer",
        isSuccess: false
    }

    var department = await app.model.Department.findOne({
        condition: {
            name: req.query.department
        }
    });
    if(!department) return {
        isSuccess: false,
        message: "Invalid department"
    }

    var issuerDepartment = await app.model.Issudept.findOne({
        condition: {
            iid: iid,
            did: department.did,
            deleted: '0'
        }
    });
    if(!issuerDepartment) return {
        isSuccess: false,
        message: "Issuer can only register employees in his departments"
    }

    var identityEmpCheck = await app.model.Employee.exists({
        identity: identity,
        deleted: '0'
    });
    if(identityEmpCheck) return {
        message: "Recipient with the same identity already exists",
        isSuccess: false
    }

        var result = await app.model.Employee.exists({
            email: email,
            deleted: "0"
        });

        if(result) return {
            message: "Recipient already registered",
            isSuccess: false
        }

        var result = await app.model.Employee.exists({
            empid: uuid,
            deleted: "0"
        });
        if(result) return {
            message: "Recipient with Recipient ID already exists",
            isSuccess: false
        }

        var request = {
            query: {
                email: email
            }
        }
        var response = await registrations.exists(request, 0);
        

        if(response.isSuccess == false) {

            //start mock
            var creat = {
                email: email,
                //empid: app.autoID.increment('employee_max_empid'),
                empid: uuid,
                name: name + " " +lastName,
                identity: identity,
                iid: issuer.iid,
                walletAddress: makePassword(),
                department: req.query.department,
                deleted: "0",
                extra: extra
            }

            console.log("About to make a row");

            app.sdb.create('employee', creat);

            var mapEntryObj = {
                address: creat.walletAddress,
                dappid: dappid
            }
            var mapcall = await SuperDappCall.call('POST', '/mapAddress', mapEntryObj);
            console.log(JSON.stringify(mapcall));

            var mailBody = {
                mailType: "sendEmployeeRegistered",
                mailOptions: {
                    to: [creat.email],
                    empname: creat.name,
                    wallet: {}
                }
            }
            mailCall.call("POST", "", mailBody, 0);

            var activityMessage = email + " is registered as an Employee in " + department + " department by " + issuer.email + ".";
            app.sdb.create('activity', {
                activityMessage: activityMessage,
                pid: email,
                timestampp: new Date().getTime(),
                atype: 'employee'
            });

            await blockWait();
            return {
                isSuccess: true,
                message: "Created employee with mock",
                employee: creat
            }
            //end mock

            token = await register.getToken(0,0);

            logger.info("Registering the Recipient on BKVS");

            console.log(token);

            if(token === "0" || token ==="-1") return "Error in retrieving token";

            function makePassword() {
                var text = "";
                var caps = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                var smalls = "abcdefghijklmnopqrstuvwxyz";
                var symbols = "@!$";
                var numbers = "1234567890";
            
                for (var i = 0; i < 3; i++){
                text += caps.charAt(Math.floor(Math.random() * caps.length));
                text += smalls.charAt(Math.floor(Math.random() * smalls.length));
                text += symbols.charAt(Math.floor(Math.random() * symbols.length));
                text += numbers.charAt(Math.floor(Math.random() * numbers.length));
                }
                return text;
            }

            var password = makePassword();        


            var options = {
                countryCode: countryCode,
                email: email,
                groupName: groupName,
                lastName: lastName,
                name: name,
                password: password,
                type: 'user'
            }

            console.log("About to call registration call with parameters: " + JSON.stringify(options));

            var response = await TokenCall.call('POST', '/api/v1/merchant/user/register', options, token);

            if(!response) return {
                message: "No response from register call",
                isSuccess: false
            }
            if(!response.isSuccess) return {
                message: JSON.stringify(response),
                isSuccess: false
            }
            console.log("Registration response is complete with response: " + JSON.stringify(response));
            var wallet = response.data;

            var creat = {
                email: email,
                //empid: app.autoID.increment('employee_max_empid'),
                empid: uuid,
                name: name + " " +lastName,
                identity: identity,
                iid: issuer.iid,
                walletAddress: wallet.walletAddress,
                department: req.query.department,
                deleted: "0",
                extra: extra
            }

            console.log("About to make a row");

            app.sdb.create('employee', creat);

            var mapEntryObj = {
                address: wallet.walletAddress,
                dappid: dappid
            }
            var mapcall = await SuperDappCall.call('POST', '/mapAddress', mapEntryObj);
            console.log(JSON.stringify(mapcall));

            var mailBody = {
                mailType: "sendEmployeeRegistered",
                mailOptions: {
                    to: [creat.email],
                    empname: creat.name,
                    wallet: wallet
                }
            }
            mailCall.call("POST", "", mailBody, 0);

            var activityMessage = email + " is registered as an Employee in " + department + " department by " + issuer.email + ".";
            app.sdb.create('activity', {
                activityMessage: activityMessage,
                pid: email,
                timestampp: new Date().getTime(),
                atype: 'employee'
            });

            await blockWait();

            return {
                message: "Registered",
                isSuccess: true,
                employee: creat
            }

        }
            
        else{
            logger.info("Sent email to the employee to share wallet address");
            var check = await app.model.Pendingemp.findOne({
                condition: {
                    email: email
                }
            });
            if(check){
                app.sdb.del('pendingemp', {token: check.token});
            }
            var jwtToken = await authJwt.getJwt(email);  
            var crea = {
                email: email,
                empid: uuid,
                name: name + " " + lastName,
                identity: identity,
                iid: issuer.iid,
                token: jwtToken,
                department: req.query.department,
                extra: extra
            }
            app.sdb.create("pendingemp", crea);
            console.log("Asking address");

            var mailBody = {
                mailType: "sendAddressQuery",
                mailOptions: {
                    to: [crea.email],
                    token: jwtToken,
                    dappid: dappid
                }
            }

            await blockWait();

            mailCall.call("POST", "", mailBody, 0);

            return {
                token: jwtToken,
                message: "Awaiting wallet address",
                isSuccess: true
            }
        }
})

app.route.post("/payslips/verifyMultiple", async function(req, cb){
    logger.info("Entered /payslips/verifyMultiple API");
    var pids = req.query.pids;
    var result = {};

    for(pid in pids){
        var issue = await app.model.Issue.findOne({
            condition: {
                pid: pids[pid]
            }
        });
        var req = {
            query: {
                data: issue.data
            }
        }
        var verificationResult = await verifyPayslip(req, 0);
        verificationResult.jsonPayslip = issue.data;
        result[pids[pid]] = verificationResult;
    }
    return result;
});

app.route.post('/payslips/sentForAuthorization', async function(req, cb){
    logger.info("Entered /payslips/sentForAuthorization API");
    var count = await app.model.Issue.count({
        status: 'pending'
    });
    return {
        count: count,
        isSuccess: true
    };
})

app.route.post('/authorizer/authorizedAssets', async function(req, cb){
    logger.info("Entered /authorizer/authorizedAssets API");
    var aid = req.query.aid;
    var result = [];
    var css = await app.model.Cs.findAll({
        condition: {
            aid: aid
        }, 
        limit: req.query.limit,
        offset: req.query.offset
    });
    for(i in css){
        var issue = await app.model.Issue.findOne({
            condition: {
                pid: css[i].pid
            }
        });

        var employee = await app.model.Employee.findOne({
            condition: {
                empid: issue.empid
            },
            fields: ['email']
        });

        var department = await app.model.Department.findOne({
            condition: {
                did: issue.did
            }
        });
        issue.totalLevels = department.levels;
        issue.email = employee.email;
        result.push(issue);
    }
    return {
        result: result,
        isSuccess: true
    }
})

app.route.post('/issuer/issuedPayslips', async function(req, cb){
    logger.info("Entered /issuer/issuedPayslips");
    console.log("Entered here")
    var issuerCheck = await app.model.Issuer.exists({
        iid: req.query.iid
    })
    if(!issuerCheck) return {
        isSuccess: false,
        message: "Invalid issuer"
    }
    var total = await app.model.Issue.count({
        iid: req.query.iid,
        status: 'issued'
    });
    console.log("total: " + total);
    var issues = await app.model.Issue.findAll({
        condition: {
            iid: req.query.iid,
            status: 'issued'
        },
        limit: req.query.limit,
        offset: req.query.offset
    })
    return {
        total: total,
        result: issues,
        isSuccess: true
    }
})

function makePassword() {
    var text = "";
    var caps = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var smalls = "abcdefghijklmnopqrstuvwxyz";
    var symbols = "!@$";
    var numbers = "1234567890";

    for (var i = 0; i < 3; i++){
    text += caps.charAt(Math.floor(Math.random() * caps.length));
    text += smalls.charAt(Math.floor(Math.random() * smalls.length));
    text += symbols.charAt(Math.floor(Math.random() * symbols.length));
    text += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return text;
}

app.route.post('/registerUser/', async function(req, cb){
    await locker("registerUser@" + role);


    var email = req.query.email;
    var countryCode = req.query.countryCode;
    var countryId = req.query.countryId;
    var name = req.query.name;
    var type = req.query.type;
    var dappid = util.getDappID();
    var role = req.query.role;
    var departments = req.query.departments;

        logger.info("Entered registerUser with email: " + email + " and role: " + role + "and dappid: " + dappid);
        console.log("Entered Register User");

        switch(role){
            case "issuer": 
                result = await app.model.Issuer.exists({
                    email: email,
                    deleted: '0'
                });
                break;

            case "authorizer":
                result = await app.model.Authorizer.exists({
                    email: email,
                    deleted: '0'
                });
                break;

            default: 
                    logger.error("Invalid role");
                    return {
                        message: "Invalid role",
                        isSuccess: false
                    }
        }

        if(result){
            logger.error("User already registered");
            return {
                message: "User already registered",
                isSuccess: false
            }
        }

        if(role === 'issuer' && !departments) return {
            isSuccess: false,
            message: "Please define atleast one department for the user"
        }

        for(let i in departments){
            let department = await app.model.Department.findOne({
                condition: {
                    name: departments[i].name
                }
            });
            if(!department) return {
                isSuccess: false,
                message: "Invalid department"
            }
            departments[i].did = department.did
            if(role === 'authorizer') {
                if(!departments[i].level) return {
                    isSuccess: false,
                    message: "Need to provide a level for authorizer"
                }
                if(departments[i].level <= 0 || departments[i].level > department.levels) return {
                    isSuccess: false,
                    message: "Provide valid levels for that department"
                }
            }
        }

        var request = {
            query: {
                email: email
            }
        }
        var response = await registrations.exists(request, 0);      

        if(!response.isSuccess){
            var request = {
                query: {
                    countryId:countryId,
                    countryCode:countryCode,
                    email:email,
                    name:name,
                    password:makePassword(),
                    type:type
                }
            }
            var resultt = await registrations.signup(request, 0);
            if(resultt !== "success") return {
                message: JSON.stringify(resultt),
                isSuccess: false
            }

            var wallet = {
                password: request.query.password
            }
    
            var mailBody = {
                mailType: "sendRegistered",
                mailOptions: {
                    to: [email],
                    empname: name,
                    wallet: wallet
                }
            }
            mailCall.call("POST", "", mailBody, 0);

            logger.info("Registered a new user");
        }
        
        var mapObj = {
            email: email,
            dappid: dappid,
            role: role
        }
        var mapcall = await SuperDappCall.call('POST', "/mapUser", mapObj);
        // Need some exception handling flow for the case when a email with a particular role is already registered on the dapp.
        if(!mapcall.isSuccess) return mapcall;

        var returnObj = {
            isSuccess: true
        }

        var timestampp = new Date().getTime();
        switch(role){

            case "issuer": 
            //getting the last registered id of an issuer
                app.sdb.create('issuer', {
                    iid: app.autoID.increment('issuer_max_iid'),
                    publickey: "-",
                    email: email,
                    timestampp: timestampp,
                    deleted: "0"
                });
                logger.info("Created an issuer");
                //Registering the issuer in the given departments
                iid = app.autoID.get('issuer_max_iid')
                for(let i in departments) {
                    app.sdb.create('issudept', {
                        iid: iid,
                        did: departments[i].did,
                        deleted: '0'
                    });
                }
                returnObj.iid = iid;
                break;

            case "authorizer":
                app.sdb.create('authorizer', {
                    aid: app.autoID.increment('authorizer_max_aid'),
                    publickey: "-",
                    email: email,
                    timestampp: timestampp,
                    deleted: "0"
                });
                logger.info("Created an authorizer");
                //Registering the authorizer in the given departments
                aid = app.autoID.get('authorizer_max_aid')
                returnObj.aid = aid;
                break;
            default: return {
                message: "Invalid role",
                isSuccess: false
            }
        }

        if(response.isSuccess){
            var mailBody = {
                mailType: "sendWelcome",
                mailOptions: {
                    to: [email],
                    name: name,
                    role: role
                }
            }
            mailCall.call("POST", "", mailBody, 0);
        }

        var activityMessage = email + " is registered as an " + role;
        app.sdb.create('activity', {
            activityMessage: activityMessage,
            pid: email,
            timestampp: timestampp,
            atype: role
        });

        await blockWait();

        return returnObj;
});

app.route.post('/department/assignAuthorizers', async function(req, cb){
    await locker('/department/assignAuthorizers');

    var levels = req.query.levels;

    for(i in levels){
        if(levels[i] === 'null') continue;
        var check = await app.model.Authorizer.exists({
            aid: levels[i],
            deleted: '0'
        });
        if(!check) return {
            isSuccess: false,
            message: "Invalid authorizer"
        }
    }

    var department = await app.model.Department.findOne({
        condition: {
            name: req.query.department
        }
    });
    

    if(department) {
        app.sdb.update('authdept', {deleted: '1'}, {
            did: department.did,
            deleted: '0'
        });
        app.sdb.update('department', {levels: levels.length}, {did: department.did});
        var did = department.did
    }
    else{
        app.sdb.create('department', {
            did: app.autoID.increment('department_max_did'),
            name: req.query.department,
            levels: levels.length
        });
        var did = app.autoID.get('department_max_did');
    }   
    for(i in levels){
        if(levels[i] === "null") continue;
        app.sdb.create('authdept', {
            aid: levels[i],
            did: did,
            level: Number(i) + 1,
            deleted: '0'
        });
    }
    
    await blockWait();
    
    if(!department) return {
        isSuccess: true,
        message: "Created department and assigned"
    
    }
    var pendingIssues = await app.model.Issue.findAll({
        condition: {
            status: 'pending',
            did: department.did
        }
    });

    for(i in pendingIssues){
        var level = pendingIssues[i].authLevel;
        while(1){
            if(level > levels.length){
                app.sdb.update('issue', {status: 'authorized'}, {
                    pid: pendingIssues[i].pid
                });
                level--;
                break;
            }
            var authLevelCount = await app.model.Authdept.count({
                did: department.did,
                level: level,
                deleted: '0'
            });
            if(authLevelCount) break;

            level++;
        }
        app.sdb.update('issue', {authLevel: level}, {
            pid: pendingIssues[i].pid
        });
    }

    await blockWait();

    return {
        isSuccess: true,
        message: "Department and respective payslips updated"
    }
});

app.route.post('/getActivities', async function(req, cb){
    var count = await app.model.Activity.count({});
    if(req.query.count === undefined) return {
        message: "Provide count",
        isSuccess: false
    }
    if(req.query.count >= count) return {
        message: "Nil",
        isSuccess: true
    }
    var activities = await app.model.Activity.findAll({
        limit: req.query.limit,
        offset: req.query.offset,
        sort: {
            timestampp: -1
        }
    });
    return {
        activities: activities,
        isSuccess: true,
        count: count
    }
});

app.route.post('/payslip/payment', async function(req, cb){
    if(!req.query.centralServerKey) return {
        isSuccess: false,
        message: "Need central server key to access this API"
    }
    if(!util.centralServerCheck(req.query.centralServerKey)) return {
        isSuccess: false,
        message: "Central Server Authentication failed"
    }

    await locker("/payslip/payment@" + req.query.link);

    var paysliplink = await app.model.Paysliplink.findOne({
        condition: {
            link: req.query.link
        }
    })
    if(!paysliplink) return {
        message: "Invalid link",
        isSuccess: false
    }

    if(paysliplink.payed === '1') return {
        isSuccess: false,
        message: "Already paid"
    }

    app.sdb.update('paysliplink', {payed: '1'}, {link: req.query.link});
    app.sdb.create('earning', {
        paysliplink: req.query.link,
        email: req.query.email,
        ownerEarning: req.query.ownerEarning,
        adminEarning: req.query.adminEarning,
        orderId: req.query.orderId,
        timestampp: new Date().getTime()
    });

    await blockWait();

    return {
        isSuccess: true
    }
})

app.route.post('/generatePayslipLink', async function(req, cb){
    await locker("/generatePayslipLink@" + req.query.pid)
    var issue = await app.model.Issue.findOne({
        condition: {
            pid: req.query.pid,
        }
    });
    if(!issue) return {
        message: "Invalid Asset",
        isSuccess: false
    }
    if(issue.status !== 'issued') return {
        message: "Asset not issued yet",
        isSuccess: false
    }

    var hash = Buffer.from(issue.hash).toString('base64');
    var link = req.query.link + "/" + hash;

    var days = req.query.days || 1;

    var validity = new Date().getTime() + days * 86400000;

    app.sdb.create('paysliplink', {
        link: link,
        payed: '0',
        validity: validity
    });

    var employee = await app.model.Employee.findOne({
        condition: {
            empid: issue.empid
        }
    })

    var mailBody = {
        mailType: "sendAssetLink",
        mailOptions: {
            to: [req.query.email],
            name: employee.name,
            link: link
        }
    }

    await blockWait();

    mailCall.call("POST", "", mailBody, 0);

    return {
        link: link,
        isSuccess: true
    }
}); 

app.route.post("/centralserver/addIssuelimits", async function(req){
    if(!req.query.centralServerKey) return {
        isSuccess: false,
        message: "Need to provide the centralServerKey, issue limit not updated."
    }
    if(!util.centralServerCheck(req.query.centralServerKey)) return {
        isSuccess: false,
        message: "Central Server authentication failed, issue limit not updated."
    }         
    if(!(req.query.limit && req.query.expirydate)) return {
        isSuccess: false,
        message: "Need to provide a new limit and expirydate."
    }
    try{
        req.query.limit = Number(req.query.limit);
    } catch(err){
        return {
            isSuccess: false,
            message: "Limit should be a number"
        }
    }
    var limit = await app.model.Issuelimit.findOne({
        condition: {
            name: "issuelimit"
        }
    });
    if(!limit){
        app.sdb.create("issuelimit", {
            name: "issuelimit",
            value: req.query.limit,
            expirydate: req.query.expirydate
        });
    } else {
        app.sdb.update("issuelimit", {
            value: req.query.limit
        }, {
            name: "issuelimit"
        });
        app.sdb.update("issuelimit", {
            expirydate: req.query.expirydate
        }, {
            name: "issuelimit"
        });
    }
    await blockWait();
    return {
        isSuccess: true
    }
});

app.route.post("/getIssueLimit", async function(req){
    var limit = await app.model.Issuelimit.findOne({
        condition: {
            name: "issuelimit"
        }
    });
    if(!limit) return {
        isSuccess: false,
        message: "Limit not defined"
    }
    return {
        isSuccess: true,
        limit: limit.value,
        expirydate: limit.expirydate
    }
});
