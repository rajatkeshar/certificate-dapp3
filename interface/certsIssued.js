var logger = require("../utils/logger");
var utils = require('../utils/util');

app.route.post('/totalCertsIssued', async function(req, cb)
{
    logger.info("Entered /totalCertsIssued API");
    var totalCerts = await app.model.Issue.count({status:"issued"});
    return {
        totalCertificates: totalCerts,
        isSuccess: true
    };
});

app.route.post('/totalEmployee', async function(req, cb)
{
    logger.info("Entered /totalEmployee API");
   var totalemp= await app.model.Employee.count({
       deleted: '0'
   });
    return {
         totalEmployee: totalemp,
         isSuccess: true
        };
});

//- get all employees name, id, designation with dappid
//Inputs: limit, offset
app.route.post('/employee/details',async function(req,cb){
    logger.info("Entered /employee/details");
var res=await app.model.Employee.findAll({
    condition: {
        deleted: '0'
    },
    fields:['empid','name'],
    limit: req.query.limit,
    offset: req.query.offset,
})
return res;
});


// Inputs: limit
app.route.post('/recentIssued', async function(req, cb)
{
    //var num = await app.model.Issue.count({status:"issued"});
    logger.info("Entered /recentIssued API");
    var res= await app.model.Issue.findAll({
        condition:{
            status:"issued"
        },
        fields:['pid', 'timestampp', 'iid'],
        sort: {
            timestampp: -1
        },
        limit: req.query.limit
    });
    for (i in res){
        var employee = await app.model.Employee.findOne({
            condition: {
                empid: res[i].empid
            }
        });

        var issuer = await app.model.Issuer.findOne({
            condition: {
                iid: res[i].iid
            },
            fields: ['email']
        })

        res[i].name= employee.name;
        res[i].empid=employee.empid;
        res[i].empemail = employee.email;
        res[i].issuedBy = issuer.email;
    }
  return res;
});


// Inputs: limit, offset
app.route.post('/getEmployees', async function(req, cb)
{
    logger.info("Entered /getEmployees API");
    var total = await app.model.Employee.count({
        deleted: '0'
    });
    var employees = await app.model.Employee.findAll({
        condition: {
            deleted: '0'
        },
        limit: req.query.limit,
        offset: req.query.offset
    });

    return {
        total: total,
        employees: employees
    }
})

app.route.post('/getEmployeeById', async function(req, cb)
{
    logger.info("Entered /getEmployeeById API");
    var employee = await app.model.Employee.findOne({
        condition : {
            empid : req.query.id
        }
    });
    if(!employee) return {
        message: "Employee not found",
        isSuccess: false
    }
    employee.identity = JSON.parse(Buffer.from(employee.identity, 'base64').toString());
})

app.route.post('/getPendingAuthorizationCount', async function(req, cb){
    logger.info("Entered /getPendingAuthorizationCount API");
    var result = await app.model.Issue.count({
        status: "pending",
    });
    return {
        totalUnauthorizedCertificates: result,
        isSuccess: true
    }
});

app.route.post('/employee/id/exists', async function(req, cb){
    logger.info("Entered /employee/id/exists API");
    var fields = ['empID', 'name', 'email'];
    for(i in fields){
        let condition = {};
        condition[fields[i]] = req.query.text;
        let employee = await app.model.Employee.findAll({
            condition: condition
        });
        if(employee.length){
            for(j in employee){
            employee[j].identity = JSON.parse(Buffer.from(employee[j].identity, 'base64').toString());
            }
            return {
                employee: employee,
                isSuccess: true,
                foundWith: fields[i],
                status: "employee"
            }
        }
        let pendingEmp = await app.model.Pendingemp.findAll({
            condition: condition
        });
        if(pendingEmp.length){
            for(j in pendingEmp){
            pendingEmp[j].identity = JSON.parse(Buffer.from(pendingEmp[j].identity, 'base64').toString());
            }
            return {
                employee: pendingEmp,
                isSuccess: true,
                foundWith: fields[i],
                status: "pending employee"
            }
        }
    }
    return {
        isSuccess: false,
        message: "Not found in " + JSON.stringify(fields)
    }
});

app.route.get('/assets/:status/count', async function(req){
    var total = await app.model.Issue.count({
        status: req.paramter.status
    });
    return {
        total: total,
        isSuccess: true
    }
});

app.route.get('/assets/:status', async function(req){
    var condition = {
        status: req.paramter.status
    }
    var total = await app.model.Issue.count(condition);
    var result = await app.model.Issue.findAll({
        condition: condition,
        limit: req.query.limit,
        offset: req.query.offset
    });
    return {
        total: total,
        result: result,
        isSuccess: true
    }
});

app.route.get('/recipients/count', async function(req){
    var total = await app.model.Employee.count({
        deleted: '0'
    });
    return {
        total: total,
        isSuccess: true
    }
});

app.route.post('/issuer/issuedAssets/monthyear/count', async function(req){
    var issuer = await app.model.Issuer.exists({
        iid: req.query.iid
    });
    if(!issuer) return {
        isSuccess: false,
        message: "Issuer doesn't exist"
    }
    var year = req.query.year;
    var monthCount = [];
    for(let i = 1; i <= 12; i++){
        var limits = utils.getMilliSecondLimits(i, year);
        var count = await app.model.Issue.count({
            iid: req.query.iid,
            status: 'issued',
            timestampp: {
                $gte: limits.first,
                $lte: limits.last
            }
        });
        monthCount.push(count);
    }
    return {
        monthCount: monthCount,
        isSuccess: true
    }
});

app.route.post('/authorizer/authorizedAssets/month/count', async function(req){
    var authorizer = await app.model.Authorizer.exists({
        aid: req.query.aid
    });
    if(!authorizer) return {
        isSuccess: false,
        message: "Authorizer doesn't exist"
    }
    var year = req.query.year;
    var monthCount = [];
    for(let i = 1; i <= 12; i++){
        var limits = utils.getMilliSecondLimits(i, year);
        var count = await app.model.Cs.count({
            aid: req.query.aid,
            timestampp: {
                $gte: limits.first,
                $lte: limits.last
            }
        });
        monthCount.push(count);
    }
    return {
        monthCount: monthCount,
        isSuccess: true
    }
});

app.route.post('/issuedAssets/address', async function(req){
    var employee = await app.model.Employee.findOne({
        condition: {
            walletAddress: req.query.address
        }
    });
    console.log("Wallet Address: ", employee);

    if(!employee) return {
        isSuccess: false,
        message: "Address doesn't exist"
    }

    var res = await app.model.Issue.findAll({
        condition:{
            empid:employee.empid
        },
        sort: {
            timestampp: -1
        },
        limit: req.query.limit
    });

    return {
        data: res
    }
});
