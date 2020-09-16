module.exports = {
  registerEmployee: async function(email, uuid, fullName, identity, issuerId, walletAddress, department, extra) {
    app.sdb.lock('register.registerEmployee' + email)
    app.sdb.create('Employee', {
      email: email,
      empid: uuid,
      name: fullName,
      identity: identity,
      iid: issuerId,
      walletAddress: walletAddress,
      department: department,
      timestamp: new Date().getTime(),
      deleted: "0",
      extra: extra
    })
  },
  registerPendingEmployee: async function(email, uuid, fullName, identity, issuerId, token, department, extra) {
    app.sdb.lock('register.registerPendingEmployee' + email);
    app.sdb.del('pendingemp', {email: email});
    app.sdb.create('pendingemp', {
      email: email,
      empid: uuid,
      name: fullName,
      identity: identity,
      iid: issuerId,
      token: token,
      department: department,
      timestamp: new Date().getTime(),
      extra: extra
    })
  },
  registerIssuer: async function(email, issuerId, departments, timestampp) {
    app.sdb.lock('register.registerIssuer' + email);
    await app.sdb.create('issuer', {
      email: email,
      publickey: "-",
      iid: issuerId,
      timestampp: timestampp,
      deleted: "0"
    });
    //Registering the issuer in the given departments
    for(let i in departments) {
      await app.sdb.create('issudept', {
          iid: issuerId,
          did: departments[i].did,
          deleted: '0'
      });
    }
  },
  registerAuthorizer: async function(email, authorizerId, timestampp) {
    app.sdb.lock('register.registerAuthorizer' + email);
    app.sdb.create('authorizer', {
      email: email,
      aid: authorizerId,
      publickey: "-",
      timestampp: timestampp,
      deleted: "0"
    });
  }
}
