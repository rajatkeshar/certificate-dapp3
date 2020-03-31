var BKVSCall = require('../utils/BKVSCall.js');
var SuperDappCall = require("../utils/SuperDappCall");
var DappCall = require("../utils/DappCall");
var SwaggerCall = require('../utils/SwaggerCall.js');
var logger = require("../utils/logger");
var locker = require("../utils/locker");
var blockWait = require("../utils/blockwait");
var util = require("../utils/util");



// // Return Payslip with empname
// app.route.get('/payslip/:empname',  async function (req) {
//     let result = await app.model.Payslip.findOne({
//         condition: { empname: req.params.empname }
//     })
//     return result
//   })

module.exports.exists = async function(req, cb){

    logger.info("Checking user exists on BKVS or not");

    var param = {
        email: req.query.email
    }

    // if(!req.query.dappToken) return "Need Dapp Token, please Login";
    // if(! (await auth.checkSession(req.query.dappToken))) return "Unauthorized Token";

    var response = await SwaggerCall.call('GET', '/api/v1/user/exist?email=' + param.email, param);
    return response;
    
}

app.route.post('/user/exist', module.exports.exists);

//BKVS login
app.route.post('/userlogin', async function (req, cb) {
    logger.info("Entered BKVS login");
    var ac_params = {
        email: req.query.email,
        password: req.query.password
    };

    await locker('payroll.userlogin@'+req.query.email);


    var response = await BKVSCall.call('POST', `/api/v1/login`, ac_params);// Call: http://54.254.174.74:8080

    // if (response.isSuccess === true){
    //     var user = await app.model.Employer.findOne({
    //         condition:{
    //             email: req.query.email
    //         }
    //     });

    //     if(!user) return "-2" // User not registered in Dapp

    //     var tokenSearch = await app.model.Session.exists({
    //         email: user.email
    //     });

    //     var token = auth.getJwt(user.email);

    //     if(tokenSearch) {
    //         app.sdb.update('session', {jwtToken: token}, {email: user.email});
    //     }
    //     else{
    //         app.sdb.create('session', {
    //             email: user.email,
    //             jwtToken: token
    //         })
    //     }

    //     response.dappToken = token;
    // }
    
    return response;

 });
 
 module.exports.signup = async function (req, cb) {
     logger.info("Entered BKVS signup");
    var params={
        countryId:req.query.countryId,
        countryCode:req.query.countryCode,
        email:req.query.email,
        name:req.query.name,
        password:req.query.password,
        type:req.query.type
    }

    await locker('payroll.usersignup@'+req.query.email);

    var response = await BKVSCall.call('POST', `/api/v1/signup`, params);// Call: http://54.254.174.74:8080
    // if(response.isSuccess===true || response.status === "CONFLICT")

    if(response.isSuccess===true)
    {
        // var user = await app.model.Employer.exists({
        //     email: req.query.emailid
        // });

        // if(user) return "-1"; // User already registered

        // app.sdb.create('employer', {
        //     name: req.query.name,
        //     email: req.query.emailid
        // });

        return "success";
    }
    else
    {
        return response;
    }

 }
 //BKVS Signup
 app.route.post('/usersignup', module.exports.signup);

 app.route.post('/registerEmployeeToken', async function(req, cb){

        await locker("registerEmployeeToken@" + req.query.token);
     logger.log("Entered /registerEmployeeToken API" + req.query.token);
     var options = {
         condition: {
             token: req.query.token
         }
     }
     console.log("token: " + options.condition.token);
     var result = await app.model.Pendingemp.findOne(options);

     if(!result) return {
         message: "Invalid token",
         isSuccess: false
     }

     var mapEntryObj = {
        address: req.query.walletAddress,
        dappid: util.getDappID()
    }
    var mapcall = await SuperDappCall.call('POST', '/mapAddress', mapEntryObj);

     delete result.token;

     result.walletAddress = req.query.walletAddress;
     result.deleted = '0';
     //result.empid = app.autoID.increment('employee_max_empid');

     app.sdb.create("employee", result);

     app.sdb.del('pendingemp', {email: result.email});

     var activityMessage = result.email + " is registered as an Employee in " + result.department + " department.";
    app.sdb.create('activity', {
        activityMessage: activityMessage,
        pid: result.email,
        timestampp: new Date().getTime(),
        atype: 'employee'
    });

    await blockWait();

     return {
         isSuccess: true
     };
 });

app.route.post('/payslips/employee/issued', async function(req, cb){
    logger.info("Entered /payslips/employee/issued API");
    var employee = await app.model.Employee.findOne({
        condition: {
            walletAddress: req.query.walletAddress
        }, 
        fields: ['empid']
    });
    if(!employee) return {
        message: "Address not associated with any Recipient",
        isSuccess: false
    }

    var result = await app.model.Issue.findAll({
        condition: {
            empid: employee.empid,
            status: 'issued'
        },
        sort: {
            timestampp: -1
        },
        limit: req.query.limit,
        offset: req.query.offset
    });

    for(i in result){
        var issuer = await app.model.Issuer.findOne({
            condition: {
                iid: result[i].iid
            }
        });
        var transaction = await app.model.Transaction.findOne({
            id: result[i].transactionId
        });
        delete result[i].transactionId;
        result[i].transaction = transaction;
        result[i].issuedBy = issuer.email;
    }

    return {
        issuedPayslips: result,
        isSuccess: true
    }

})

// app.route.post('/payslips/employee/issued/search', async function(req, cb){
//     logger.info("Entered payslips/employee/issued/search");

//     var employee = await app.model.Employee.findOne({
//         condition: {
//             walletAddress: req.query.walletAddress
//         }, 
//         fields: ['empid']
//     });
//     if(!employee) return {
//         message: "Address not associated with any employee",
//         isSuccess: false
//     }

//     if(req.query.month.length){
//         let result = [];
//         let payslip = await app.model.Payslip.findOne({
//             condition: {
//                 empid: employee.empid,
//                 month: req.query.month,
//                 year: req.query.year
//             },
//             fields: ['pid', 'month', 'year']
//         });
//         if(!payslip) return {
//             message: "No payslip",
//             isSuccess: false
//         }
//         var issue = await app.model.Issue.findOne({
//             condition: {
//                 pid: payslip.pid,
//                 status: 'issued'
//             }
//         });

//         if(!issue) return {
//             message: "Payslip not issued yet",
//             isSuccess: false
//         }

//         var issuer = await app.model.Issuer.findOne({
//             condition: {
//                 iid: issue.iid
//             },
//             fields: ['email']
//         });

//         if(issuer) issue.issuedBy = issuer.email;
//         else issue.issuedBy = "Deleted Issuer";

//         issue.month = payslip.month;
//         issue.year = payslip.year;  
//         result.push(issue);   
        
//         return {
//             issuedPayslips: result,
//             isSuccess: true
//         }
//     }
//     else{
//         let result = [];
//         let payslips = await app.model.Payslip.findAll({
//             condition: {
//                 empid: employee.empid,
//                 year: req.query.year
//             },
//             fields: ['pid', 'month', 'year']
//         });
//         for(i in payslips){
//             let issue = await app.model.Issue.findOne({
//                 condition: {
//                     pid: payslips[i].pid,
//                     status: 'issued'
//                 }
//             });
//             if(!issue) continue;
//             let issuer = await app.model.Issuer.findOne({
//                 condition: {
//                     iid: issue.iid
//                 },
//                 fields: ['email']
//             });
//             if(issuer) issue.issuedBy = issuer.email;
//             else issue.issuedBy = "Deleted Issuer";

//             issue.month = payslips[i].month;
//             issue.year = payslips[i].year;  
//             result.push(issue);
//         }

//         return {
//             issuedPayslips: result,
//             isSuccess: true
//         }
//     }
// })

app.route.post('/payslip/getIssuedByPid', async function(req, cb){
    var issue = await app.model.Issue.findOne({
        condition: {
            pid: req.query.pid,
            status: 'issued'
        }
    });

    if(!issue) return {
        message: "No Payslip",
        isSuccess: false
    }

    var auths = await app.model.Cs.findAll({
        condition: {
            pid: issue.pid
        }
    });
    
    for(i in auths){
        let authorizer = await app.model.Authorizer.findOne({
            condition: {
                aid: auths[i].aid
            },
            fields: ['email']
        });
        if(!authorizer) auths[i].email = "Deleted Authorizer";
        else auths[i].email = authorizer.email;
    }

    var issuer = await app.model.Issuer.findOne({
        condition: {
            iid: issue.iid
        },
        fields: ['email']
    });
    if(!issuer) issue.issuedBy = "Deleted Issuer";
    else issue.issuedBy = issuer.email;

    return {
        issue: issue,
        authorizedBy: auths,
        isSuccess: true
    }
})

app.route.post('/payslip/returnHash', async function(req, cb){
    let issue = await app.model.Issue.findOne({
        condition: {
            pid: req.query.pid,
            status: 'issued'
        },
        fields: ['hash']
    });
    if(!issue) return {
        message: "Invalid Issued Asset",
        isSuccess: false
    }
    return {
        hash: issue.hash,
        isSuccess: true
    }   
});

app.route.post('/employee/payslips/statistic', async function(req, cb){
    var employee = await app.model.Employee.findOne({
        condition: {
            walletAddress: req.query.walletAddress
        }
    });
    if(!employee) return {
        message: "Employee not found",
        isSuccess: false
    }
    var count = await app.model.Issue.count({
        empid: employee.empid
    });
    var issues = await app.model.Issue.findAll({
        condition: {
            empid: employee.empid
        },
        fields: ['pid', 'iid', 'status', 'timestampp', 'empid'],
        sort: {
            timestampp: -1
        },
        limit: req.query.limit,
        offset: req.query.offset
    });
    
    return {
        issuedPayslips: issues,
        total: count,
        isSuccess: true
    }
});

app.route.post('/payslip/statistic', async function(req, cb){
    var issue = await app.model.Issue.findOne({
        condition: {
            pid: req.query.pid,
        }
    });
    if(!issue) return {
        message: "Invalid issue",
        isSuccess: false
    }
    var issuer = await app.model.Issuer.findOne({
        condition: {
            iid: issue.iid
        }
    });

    if(issue.status === 'rejected'){
        var rejected = await app.model.Rejected.findOne({
            condition: {
                pid: req.query.pid
            }
        });
        var authorizer = await app.model.Authorizer.findOne({
            condition: {
            aid: rejected.aid
            }
        });
        return {
            rejectedBy: authorizer,
            issuedBy: issuer,
            reason: rejected.reason,
            isSuccess: true
        }
    }
    
    var signatures = await app.model.Cs.findAll({
        condition: {
            pid: req.query.pid
        }
    });
    for(i in signatures){
        var authorizer = await app.model.Authorizer.findOne({
            condition: {
                aid: signatures[i].aid
            },
            fields: ['email']
        });
        signatures[i].email = authorizer.email
    }

    var result = {
        issue: issue,
        issuer: issuer,
        signedAuthorizersCount: signatures.length,
        signatures: signatures,
        isSuccess: true
    };

    var department = await app.model.Department.findOne({
        condition: {
            did: issue.did
        }
    });

    if(issue.status === 'pending'){
        result.currentAuthLevel = issue.authLevel;
        result.totalLevels = department.levels;
    }

    if(issue.status === 'issued'){
        var transaction = await app.model.Transaction.findOne({
            condition: {
                id: issue.transactionId
            }
        });
        result.transaction = transaction;
    }

    return result;
})

app.route.post('/payslip/statistic2', async function(req, cb){
    var issue = await app.model.Issue.findOne({
        condition: {
            pid: req.query.pid,
        }
    });
    if(!issue) return {
        message: "Invalid issue",
        isSuccess: false
    }
    var issuer = await app.model.Issuer.findOne({
        condition: {
            iid: issue.iid
        }
    });

    var authSigned = await new Promise((resolve)=>{
        let sql = "select authdepts.aid as aid, authdepts.level as level, authorizers.email as email, count(css.sign) as signed from authdepts join authorizers on authdepts.aid = authorizers.aid join issues on issues.pid = ? and issues.did = authdepts.did left join css on authdepts.aid = css.aid and css.pid = issues.pid where authdepts.deleted = '0' group by authdepts.aid;"
        app.sideChainDatabase.all(sql, [issue.pid], (err, row)=>{
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

    if(!authSigned.isSuccess) return result;

    var department = await app.model.Department.findOne({
        condition: {
            did: issue.did
        }
    });

    var template = await app.model.Template.findOne({
        condition: {
            pid: issue.pid
        }
    });

    var result = {
        issue: issue,
        issuer: issuer,
        signatures: authSigned.result,
        totalLevels: department.levels,
        isSuccess: true,
        template: template.template
    };

    if(issue.status === 'rejected'){
        var rejected = await app.model.Rejected.findOne({
            condition: {
                pid: req.query.pid
            }
        });
        var authorizer = await app.model.Authorizer.findOne({
            condition: {
            aid: rejected.aid
            }
        });
        result.rejectedBy = authorizer;
        result.reason = rejected.reason;
        return result;
    }
    
    if(issue.status === 'issued'){
        var transaction = await app.model.Transaction.findOne({
            condition: {
                id: issue.transactionId
            }
        });
        result.transaction = transaction;
    }

    return result;
})

app.route.post('/authorizer/rejecteds', async function(req, cb){
    var authorizerExists = await app.model.Authorizer.exists({
        aid: req.query.aid
    });
    if(!authorizerExists) return {
        message: "Invalid Authorizer",
        isSuccess: false
    }
    var total = await app.model.Rejected.count({
        aid: req.query.aid
    });
    var rejecteds = await app.model.Rejected.findAll({
        condition: {
            aid: req.query.aid
        },
        limit: req.query.limit,
        offset: req.query.offset
    });
    for(i in rejecteds){
        let payslip = await app.model.Issue.findOne({
            condition: {
                pid: rejecteds[i].pid
            }
        });
        var employee = await app.model.Employee.findOne({
            condition: {
                empid: payslip.empid
            }
        });

        rejecteds[i].employee = employee.email;
        rejecteds[i].issue = payslip;

        var issuer = await app.model.Issuer.findOne({
            condition: {
                iid: rejecteds[i].iid
            }
        });
        rejecteds[i].issuedBy = issuer.email
    }
    return {
        total: total,
        rejectedDetails: rejecteds,
        isSuccess: true
    }
});

app.route.post('/getPayedPayslip', async function(req, cb){

    console.log("In payroll dapp");

    var link = await app.model.Paysliplink.findOne({
        condition: {
            link: req.query.link
        }
    });
    if(!link) return {
        message: "Invalid link",
        isSuccess: false,
        query: req.query
    }

    if(Number(link.validity) < new Date().getTime()) return {
        message: "Link expired",
        isSuccess: false
    }

    var issue = await app.model.Issue.findOne({
        condition: {
            hash: Buffer.from(req.query.hash, 'base64').toString()
        }
    });
    
    if(!issue) return {
        message: "Hash not found",
        isSuccess: false
    }
    
    var pid = issue.pid;
    if(issue.status !== "issued") return {
        message: "Payslip not issued yet",
        isSuccess: false
    }
    
    // var payed = await app.model.Payment.findOne({
    //     condition: {
    //         pid: pid
    //     }
    // });

    // if(!payed) return {
    //     message: "Payslip is not payed for viewing",
    //     isSuccess: false
    // }

    // var payslip = await app.model.Payslip.findOne({
    //     condition: {
    //         pid: pid
    //     }
    // });

    // var signs = await app.model.Cs.findAll({
    //     condition: {
    //         pid: pid
    //     }
    // });

    // for(i in signs){
    //     var authorizer = await app.model.Authorizer.findOne({
    //         condition: {
    //             aid: signs[i].aid
    //         }
    //     });
    //     signs[i].authorizer = authorizer.email
    // }

    // var result = {
    //     payslip: payslip,
    //     signs: signs
    // }

    // result = Buffer.from(JSON.stringify(result)).toString('base64');

    // return {
    //     result: result,
    //     isSuccess: true
    // }

    var issuer = await app.model.Issuer.findOne({
        condition: {
            iid: issue.iid
        }
    });

    var signs = await app.model.Cs.findAll({
        condition: {
            pid: pid
        }
    });
    
    for(i in signs){
        var authorizer = await app.model.Authorizer.findOne({
            condition: {
                aid: signs[i].aid
            }
        });
        signs[i].authorizer = authorizer.email
    }

    var employee = await app.model.Employee.findOne({
        condition: {
            empid: issue.empid
        }
    });

    if(link.payed === '1') return {
        payslip: JSON.parse(issue.data),
        payment: true,
        issue: issue,
        employee: employee,
        issuer: issuer,
        signs: signs,
        pid: pid,
        dappid: req.query.dappid,
        isSuccess: true
    }

    return {
        pid: pid,
        employee: employee,
        payment: false,
        isSuccess: true,
        link: req.query.link,
        dappid: req.query.dappid
    }
})

app.route.get('/isLaunched', async function(req){
    return {
        isSuccess: true
    }
});

app.route.post('/getAssetTemplate', async function(req){
    var template = await app.model.Template.findOne({
        condition: {
            pid: req.query.pid
        }
    });
    if(!template) return {
        isSuccess: false,
        message: "Invalid pid"
    }

    return {
        isSuccess: true,
        template: template.template
    }
});
