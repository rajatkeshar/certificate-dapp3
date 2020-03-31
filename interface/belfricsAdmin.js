var defaultFee = require('../../../dappsConfig.json').defaultFee;

app.route.post('/admin/workDetails', async function(req){
    var issuersCount = await app.model.Issuer.count({
        deleted: '0'
    });
    var authorizersCount = await app.model.Authorizer.count({
        deleted: '0'
    });
    var recepientsCount = await app.model.Employee.count({
        deleted: '0'
    });
    var issuesCount = await app.model.Issue.count({
        status: 'issued'
    });
    return {
        isSuccess: true,
        issuersCount: issuersCount,
        authorizersCount: authorizersCount,
        recepientsCount: recepientsCount,
        issuesCount: issuesCount
    }
});

app.route.post('/admin/getContracts', async function(req){
    var contractObjects = app.custom.contractObjects;
    for(i in contractObjects){
        var currentFee = app.getFee(contractObjects[i].type);
        if(!currentFee) currentFee = {
            min: defaultFee
        }
        contractObjects[i].currentFee = currentFee.min
    }
    return {
        isSuccess: true,
        contracts: contractObjects
    }
});

app.route.post('/admin/setContractFees', async function(req){
    var getFees = req.query.fees;
    var contractObjects = app.custom.contractObjects;
    var failed = [];
    for(i in getFees){
        if(!contractObjects[getFees[i].contract]) {
            console.log("Wrong contracts detected");
            failed.push({
                contract: getFees[i].contract,
                message: "Contract doesn't exist on the DApp"
            })
            continue;
        }
        app.registerFee(contractObjects[getFees[i].contract].type, getFees[i].transactionFee, 'BEL');
    }
    return {
        isSuccess: true,
        failed: failed
    }
});

app.route.post('/admin/setContractFee', async function(req){
    if(!(req.query.contract && req.query.fee)) return {
        isSuccess: false,
        message: "Provide contract and fee"
    }
    var contractObjects = app.custom.contractObjects;
    if(!contractObjects[req.query.contract]) return {
        isSuccess: false,
        message: "Contract doesn't exist on the DApp"
    }
    app.registerFee(contractObjects[req.query.contract].type, req.query.fee, 'BEL');
    return {
        isSuccess: true
    }
})

app.route.get('/rechargeDetails', async function(req){
    var superUserBalance = await app.model.Balance.findOne({
        condition: {
            address: app.custom.dappOwner
        }
    });
    var certsIssued = await app.model.Issue.count({
        status: 'issued'
    });
    return {
        isSuccess: true,
        superUserBalance: superUserBalance.balance,
        issuedCount: certsIssued,
        success: true
    }
});

app.route.post('/admin/getTransactionDetails', async function(req){
    var query = `select transactions.*, transactiondetails.balance, 'issuer' as role from transactions join transactiondetails on transactions.id = transactiondetails.transactionId`
    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as count from (${query});`;
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

    var transactions = await new Promise((resolve)=>{
        let sql = `${query} limit ? offset ?;`;
        app.sideChainDatabase.all(sql, [req.query.limit || 10, req.query.offset || 0], (err, row)=>{
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
    if(!transactions.isSuccess) return transactions;

    return {
        total: total.result.count,
        transactions: transactions.result
    }
});

app.route.post('/admin/getOwnerEarnings', async function(req){
    var total = await app.model.Earning.count();
    var earnings = await app.model.Earning.findAll({
        limit: req.query.limit,
        offset: req.query.offset
    });

    return {
        isSuccess: true,
        earnings: earnings
    }
});

app.route.post('/admin/incomes', async function(req){
    var adminEarnings = await new Promise((resolve)=>{
        let sql = `select sum(adminEarning) as totalAdminEarnings from earnings;`;
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
    if(!adminEarnings.isSuccess)  adminEarnings.totalAdminEarnings = 0;

    var ownerEarnings = await new Promise((resolve)=>{
        let sql = `select sum(ownerEarning) as totalOwnerEarnings from earnings;`;
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
    if(!ownerEarnings.isSuccess) ownerEarnings.totalOwnerEarnings = 0;

    var transactionFeesEarned = await new Promise((resolve)=>{
        let sql = `select sum(transactions.fee) as transactionFeesEarned from transactions;`;
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
    if(!transactionFeesEarned.isSuccess) return transactionFeesEarned.transactionFeesEarned = 0;

    return {
        isSuccess: true,
        adminEarnings:  Number(adminEarnings.result.totalAdminEarnings),
        ownerEarnings:  Number(ownerEarnings.result.totalOwnerEarnings),
        transactionFeesEarned:  Number(transactionFeesEarned.result.transactionFeesEarned)
    }
});
