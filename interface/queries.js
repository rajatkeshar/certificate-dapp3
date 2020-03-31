var util = require("../utils/util.js");
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



app.route.post('/query/employees', async function(req){
    logger.info("Entered /query/employees API");

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as count from employees where deleted = '0';`;
        app.sideChainDatabase.get(sql, [], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });
    
    var employees = await new Promise((resolve)=>{
        let sql = `select empid, name from employees where deleted = '0' limit ? offset ?;`;
        app.sideChainDatabase.all(sql, [req.query.limit, req.query.offset], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    return {
        total: total.result.count,
        employees: employees.result
    }
});

app.route.post('/query/authorizers/pendingSigns', async function(req) {
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

    var inputs = [req.query.aid];

    var departmentCondition = "";
    if(req.query.department){
        departmentCondition = " and departments.name = ?";
        inputs.push(req.query.department);
    }

    var queryString = `select issues.*, employees.email as receipientEmail, employees.name as receipientName, departments.levels as totalLevels, departments.name as departmentName, issuers.email as issuerEmail from issues join employees on issues.empid = employees.empid join departments on issues.did = departments.did join issuers on issues.iid = issuers.iid join authdepts on authdepts.aid = ? and authdepts.level = issues.authLevel and authdepts.did = issues.did where issues.status = 'pending'${departmentCondition}`;

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as total from (${queryString});`
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    inputs.push(req.query.limit || 100, req.query.offset || 0);
    var result = await new Promise((resolve)=>{
        let sql = `${queryString}  limit ? offset ?;`;
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/superuser/statistic/pendingIssues', async function(req){
    var total = await new Promise((resolve)=>{
        let sql = "select count(1) as total from issudepts where issudepts.deleted = '0';"
        app.sideChainDatabase.get(sql, [], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!total.isSuccess) return total;

    var result = await new Promise((resolve)=>{
        let sql = "select issuers.email as issuerEmail, departments.name as department, count(issues.pid) as count from issuers join issudepts on issuers.iid = issudepts.iid join departments on issudepts.did = departments.did left join issues on issues.iid = issuers.iid and issues.status = 'authorized' and issues.did = departments.did where issuers.deleted = '0' and issudepts.deleted = '0' group by 1,2 order by 3 desc limit ? offset ?;"
        app.sideChainDatabase.all(sql, [req.query.limit || 100, req.query.offset || 0], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})


app.route.post('/query/superuser/statistic/rejectedIssues', async function(req){
    var total = await new Promise((resolve)=>{
        let sql = "select count(1) as total from authdepts where authdepts.deleted = '0';"
        app.sideChainDatabase.get(sql, [], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!total.isSuccess) return total;

    var result = await new Promise((resolve)=>{
        let sql = "select authorizers.email as authorizerEmail, departments.name as department, count(rejecteds.pid) as count from authdepts join authorizers on authdepts.aid = authorizers.aid join departments on authdepts.did = departments.did left join issues on issues.did = authdepts.did left join rejecteds on authdepts.aid = rejecteds.aid and rejecteds.pid = issues.pid where authdepts.deleted = '0' group by authorizers.email, departments.name limit ? offset ?;"
        app.sideChainDatabase.all(sql, [req.query.limit || 100, req.query.offset || 0], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/superuser/statistic/pendingAuthorization', async function(req){
    var total = await new Promise((resolve)=>{
        let sql = "select count(1) as total from authdepts where authdepts.deleted = '0';"
        app.sideChainDatabase.get(sql, [], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!total.isSuccess) return total;

    var result = await new Promise((resolve)=>{
        let sql = "select authorizers.email as authorizerEmail, departments.name as department, count(issues.pid) as count from authdepts join authorizers on authdepts.aid = authorizers.aid join departments on authdepts.did = departments.did left join issues on issues.authLevel = authdepts.level and authdepts.did = issues.did and issues.status = 'pending' and issues.pid where authdepts.deleted = '0' group by authorizers.email, departments.name limit ? offset ?;"
        app.sideChainDatabase.all(sql, [req.query.limit || 100, req.query.offset || 0], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/departments/topIssued', async function(req){
    
    var timespan = util.getMilliSecondLimits(req.query.month || new Date().getMonth() + 1, req.query.year || new Date().getFullYear());
    var result = await new Promise((resolve)=>{
        let sql = "select departments.name as department, count(issues.pid) as count from departments left join issues on issues.did = departments.did and issues.status = 'issued' and timestampp between ? and ? group by departments.name order by 2 desc limit ?;"
        app.sideChainDatabase.all(sql, [timespan.first, timespan.last, req.query.limit || 5], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        result: result.result
    }
})


app.route.post('/query/department/assets', async function(req){
    var inputs = [];
    var conditionString = " from issues where";
    var departmentCheck = await app.model.Department.exists({
        did: req.query.did
    });
    if(!departmentCheck) return {
        isSuccess: false,
        message: "Invalid Department"
    }
    conditionString += " issues.did = ?";
    inputs.push(req.query.did);
    if(req.query.status){
        conditionString += " and issues.status = ?";
        inputs.push(req.query.status);
    }
    if(req.query.month || req.query.year){
        var limits = {};
        if(req.query.month && req.query.year){
            limits = util.getMilliSecondLimits(req.query.month, req.query.year);
        }
        else if(req.query.month){
            limits = util.getMilliSecondLimits(req.query.month, new Date().getFullYear());
        }
        else{
            limits.first = util.getMilliSecondLimits(1, req.query.year).first;
            limits.last = util.getMilliSecondLimits(12, req.query.year).last;                                              
        }
        conditionString += " and issues.timestampp between ? and ?";
        inputs.push(limits.first, limits.last);
    }
    if(req.query.iid){
        conditionString += " and issues.iid = ?";
        inputs.push(req.query.iid);
    }
    if(req.query.aid){
        conditionString += " and (issues.pid in (select css.pid from css where css.aid = ?) or issues.pid in (select issues.pid from issues join authdepts on authdepts.level = issues.authLevel and authdepts.did = issues.did and authdepts.aid = ?))";
        inputs.push(req.query.aid, req.query.aid);
    }


    var total = await new Promise((resolve)=>{
        let sql = "select count(1) as total" + conditionString + ";";
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!total.isSuccess) return total;

    var result = await new Promise((resolve)=>{
        let sql = "select issues.*" + conditionString +" limit ? offset ?;"
        inputs.push(req.query.limit || 100, req.query.offset || 0);
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
});

app.route.post('/query/superuser/statistic/pendingIssues2', async function(req){
    var inputs = [];
    var departmentCondition = "";
    if(req.query.department){
        departmentCondition = " and departments.name = ?";
        inputs.push(req.query.department);
    }
    var queryString = `select issuers.email as issuerEmail, departments.name as department, count(issues.pid) as count from issuers join issudepts on issuers.iid = issudepts.iid join departments on issudepts.did = departments.did join issues on issues.iid = issuers.iid and issues.status = 'authorized' and issues.did = departments.did where issuers.deleted = '0' and issudepts.deleted = '0'${departmentCondition} group by 1,2`;

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as total from (${queryString});`
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    inputs.push(req.query.limit || 100, req.query.offset || 0);
    var result = await new Promise((resolve)=>{
        let sql = `${queryString} order by 3 desc limit ? offset ?;`;
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/superuser/statistic/pendingAuthorization2', async function(req){
    var inputs = [];
    var departmentCondition = "";
    if(req.query.department){
        departmentCondition = " and departments.name = ?";
        inputs.push(req.query.department);
    }
    var queryString = `select authorizers.email as authorizerEmail, departments.name as department, count(issues.pid) as count from authdepts join authorizers on authdepts.aid = authorizers.aid join departments on authdepts.did = departments.did join issues on issues.authLevel = authdepts.level and authdepts.did = issues.did and issues.status = 'pending' and issues.pid where authdepts.deleted = '0'${departmentCondition} group by authorizers.email, departments.name`;

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as total from (${queryString});`
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    inputs.push(req.query.limit || 100, req.query.offset || 0);
    var result = await new Promise((resolve)=>{
        let sql = `${queryString} order by 3 desc limit ? offset ?;`;
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/superuser/statistic/rejectedIssues2', async function(req){
    var inputs = [];
    var departmentCondition = "";
    if(req.query.department){
        departmentCondition = " and departments.name = ?";
        inputs.push(req.query.department);
    }
    var queryString = `select authorizers.email as authorizerEmail, departments.name as department, count(rejecteds.pid) as count from authdepts join authorizers on authdepts.aid = authorizers.aid join departments on authdepts.did = departments.did join issues on issues.did = authdepts.did join rejecteds on authdepts.aid = rejecteds.aid and rejecteds.pid = issues.pid where authdepts.deleted = '0'${departmentCondition} group by authorizers.email, departments.name`;

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as total from (${queryString});`
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    inputs.push(req.query.limit || 100, req.query.offset || 0);
    var result = await new Promise((resolve)=>{
        let sql = `${queryString} order by 3 desc limit ? offset ?;`;
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/issuer/statistic/pendingIssues', async function(req){
    var checkIssuer = await app.model.Issuer.findOne({
        condition:{
            iid: req.query.iid,
            deleted: '0'
        }
    });
    if(!checkIssuer) return {
        message: "Invalid Issuer",
        isSuccess: false
    }
    var inputs = [req.query.iid];

    var departmentCondition = "";
    if(req.query.department){
        departmentCondition = " and departments.name = ?";
        inputs.push(req.query.department);
    }

    var queryString = ` select issues.pid as pid, departments.name as departmentName, employees.name as receipientName, issues.authLevel as authLevel, departments.levels as totalLevels, issues.timestampp as timestamp, employees.email as receipientEmail from issues join departments on issues.did = departments.did join employees on issues.empid = employees.empid where issues.status = 'authorized' and issues.iid = ?${departmentCondition}`;

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as total from (${queryString});`
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    inputs.push(req.query.limit || 100, req.query.offset || 0);
    var result = await new Promise((resolve)=>{
        let sql = `${queryString}  limit ? offset ?;`;
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/issuer/statistic/issuedIssues', async function(req){
    var checkIssuer = await app.model.Issuer.findOne({
        condition:{
            iid: req.query.iid,
            deleted: '0'
        }
    });
    if(!checkIssuer) return {
        message: "Invalid Issuer",
        isSuccess: false
    }
    var inputs = [req.query.iid];

    var departmentCondition = "";
    if(req.query.department){
        departmentCondition = " and departments.name = ?";
        inputs.push(req.query.department);
    }

    var queryString = ` select issues.pid as pid, departments.name as departmentName, employees.name as receipientName, issues.authLevel as authLevel, departments.levels as totalLevels, issues.timestampp as timestamp, employees.email as receipientEmail, issues.transactionId as transactionId from issues join departments on issues.did = departments.did join employees on issues.empid = employees.empid where issues.status = 'issued' and issues.iid = ?${departmentCondition}`;

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as total from (${queryString});`
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    inputs.push(req.query.limit || 100, req.query.offset || 0);
    var result = await new Promise((resolve)=>{
        let sql = `${queryString}  limit ? offset ?;`;
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/issuer/statistic/rejectedIssues', async function(req){
    var checkIssuer = await app.model.Issuer.findOne({
        condition:{
            iid: req.query.iid,
            deleted: '0'
        }
    });
    if(!checkIssuer) return {
        message: "Invalid Issuer",
        isSuccess: false
    }
    var inputs = [req.query.iid];

    var departmentCondition = "";
    if(req.query.department){
        departmentCondition = " and departments.name = ?";
        inputs.push(req.query.department);
    }

    var queryString = ` select issues.pid as pid, departments.name as departmentName, employees.name as receipientName, issues.authLevel as authLevel, departments.levels as totalLevels, rejecteds.timestampp as timestamp, employees.email as receipientEmail from issues join departments on issues.did = departments.did join employees on issues.empid = employees.empid join rejecteds on rejecteds.pid = issues.pid where issues.status = 'rejected' and issues.iid = ?${departmentCondition}`;

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as total from (${queryString});`
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    inputs.push(req.query.limit || 100, req.query.offset || 0);
    var result = await new Promise((resolve)=>{
        let sql = `${queryString}  limit ? offset ?;`;
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/authorizer/statistic/signedIssues', async function(req){
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

    var inputs = [req.query.aid];

    var departmentCondition = "";
    if(req.query.department){
        departmentCondition = " where departments.name = ?";
        inputs.push(req.query.department);
    }

    var queryString = ` select issues.pid as pid, departments.name as departmentName, employees.name as receipientName, issues.authLevel as authLevel, departments.levels as totalLevels, css.timestampp as timestamp, employees.email as receipientEmail, issuers.email as issuerEmail, issuers.iid as iid from issues join departments on issues.did = departments.did join employees on issues.empid = employees.empid join issuers on issues.iid = issuers.iid join css on css.pid = issues.pid and css.aid = ?${departmentCondition}`;

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as total from (${queryString});`
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    inputs.push(req.query.limit || 100, req.query.offset || 0);
    var result = await new Promise((resolve)=>{
        let sql = `${queryString}  limit ? offset ?;`;
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/authorizer/statistic/rejectedIssues', async function(req){
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

    var inputs = [req.query.aid];

    var departmentCondition = "";
    if(req.query.department){
        departmentCondition = " where departments.name = ?";
        inputs.push(req.query.department);
    }

    var queryString = ` select issues.pid as pid, DEPARTMENTS.name as departmentName, employees.name as receipientName, issues.authLevel as authLevel, departments.levels as totalLevels, rejecteds.timestampp as timestamp, employees.email as receipientEmail, issuers.email as issuerEmail, issuers.iid as iid from issues join departments on issues.did = departments.did join employees on issues.empid = employees.empid join issuers on issues.iid = issuers.iid join rejecteds on rejecteds.pid = issues.pid and rejecteds.aid = ?${departmentCondition}`;

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as total from (${queryString});`
        app.sideChainDatabase.get(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    inputs.push(req.query.limit || 100, req.query.offset || 0);
    var result = await new Promise((resolve)=>{
        let sql = `${queryString}  limit ? offset ?;`;
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        total: total.result.total,
        result: result.result
    }
})

app.route.post('/query/employees2', async function(req){
    logger.info("Entered /query/employees2 API");

    var issuerFilterCondition = "";
    var issuerFilterCondition2 = "";
    var queryArray = [];
    if(req.query.iid){
        issuerFilterCondition = " join issudepts on issudepts.iid = ? join departments on departments.did = issudepts.did";
        issuerFilterCondition2 = " and employees.department = departments.name"
        queryArray.push(req.query.iid);
    }

    var query = `select employees.empid, employees.email, employees.name, employees.department, count(issues.pid) as assetCount from employees left join issues on issues.empid = employees.empid and issues.status = 'issued'${issuerFilterCondition} where employees.deleted = '0'${issuerFilterCondition2} group by employees.empid`; 

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) from (${query});`;
        app.sideChainDatabase.get(sql, queryArray, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    queryArray.push(req.query.limit || 20, req.query.offset || 0);
    
    var employees = await new Promise((resolve)=>{
        let sql = `${query} limit ? offset ?;`;
        app.sideChainDatabase.all(sql, queryArray, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    return {
        total: total.result.count,
        employees: employees.result
    }
});

app.route.post('/rejecteds/reasons/count', async function(req){
    logger.info("E/rejecteds/resons/count API");

    var reasons = await new Promise((resolve)=>{
        let sql = `select rejecteds.reason, count(*) as count from rejecteds group by rejecteds.reason;`;
        app.sideChainDatabase.all(sql, [], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    return {
        reasons: reasons.result,
        isSuccess: true
    }
});

app.route.post('/query/issuer/departments/ranks', async function(req){

    var issuer = await app.model.Issuer.findOne({
        condition: {
            iid: req.query.iid
        }
    });
    if(!issuer) return {
        isSuccess: false,
        message: "Issuer not found"
    }

    var inputs = [];
    var conditionString = "select departments.name, count(issues.pid) as issuedCount from issudepts join departments on departments.did = issudepts.did left join issues on issudepts.iid = issues.iid and issues.status = 'issued' and issudepts.did = issues.did";

    if(req.query.month || req.query.year){
        var limits = {};
        if(req.query.month && req.query.year){
            limits = util.getMilliSecondLimits(req.query.month, req.query.year);
        }
        else if(req.query.month){
            limits = util.getMilliSecondLimits(req.query.month, new Date().getFullYear());
        }
        else{
            limits.first = util.getMilliSecondLimits(1, req.query.year).first;
            limits.last = util.getMilliSecondLimits(12, req.query.year).last;                                              
        }
        conditionString += " and issues.timestampp between ? and ?";
        inputs.push(limits.first, limits.last);
    }

    var result = await new Promise((resolve)=>{
        let sql = conditionString +" where issudepts.iid = ? group by departments.name order by issuedCount desc limit ?;"
        inputs.push(req.query.iid,req.query.limit || 5);
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        result: result.result
    }
});

app.route.post('/query/authorizer/departments/ranks', async function(req){

    var authorizer = await app.model.Authorizer.findOne({
        condition: {
            aid: req.query.aid
        }
    });
    if(!authorizer) return {
        isSuccess: false,
        message: "Authorizer not found"
    }

    var inputs = [];
    var conditionString = "select departments.name, count(issues.pid) as count from authdepts join departments on departments.did = authdepts.did left join issues on issues.did = authdepts.did and (issues.pid in (select css.pid from css where css.aid = authdepts.aid) or issues.pid in (select rejecteds.pid from rejecteds where rejecteds.aid = authdepts.aid))";

    if(req.query.month || req.query.year){
        var limits = {};
        if(req.query.month && req.query.year){
            limits = util.getMilliSecondLimits(req.query.month, req.query.year);
        }
        else if(req.query.month){
            limits = util.getMilliSecondLimits(req.query.month, new Date().getFullYear());
        }
        else{
            limits.first = util.getMilliSecondLimits(1, req.query.year).first;
            limits.last = util.getMilliSecondLimits(12, req.query.year).last;                                              
        }
        conditionString += " and issues.timestampp between ? and ?";
        inputs.push(limits.first, limits.last);
    }

    var result = await new Promise((resolve)=>{
        let sql = conditionString +" where authdepts.aid = ? group by departments.name order by count desc limit ?;"
        inputs.push(req.query.aid,req.query.limit || 5);
        app.sideChainDatabase.all(sql, inputs, (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    if(!result.isSuccess) return result;

    return {
        isSuccess: true,
        result: result.result
    }
});

app.route.post('/query/department/issuedCount', async function(req){

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as count from issues join departments on departments.did = issues.did where issues.status = 'issued' and departments.name = ?;`;
        app.sideChainDatabase.get(sql, [req.query.department], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });

    return {
        isSuccess: true,
        count: total.result.count
    }
});
