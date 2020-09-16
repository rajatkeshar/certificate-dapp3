var config = require("../../../dappsConfig.json");
var nodeServer = config.centralServer + ":8080";

module.exports = {
  fixedPoint : Math.pow(10, 10),
  defaultCurrency: 'BEL', // default currency symbole for Belrium
  totalSupply: 2100000000000000000,
  URL: "http://localhost:9305",
  URI: config.bkvs,
  URX: config.bkvs,
  CRX: "http://localhost:9305/api/dapps/" + config.superdapp ,
  LSR: "http://localhost:9305/api/dapps/",
  MRI: nodeServer + "/sendMail/",
  admin: {
    secret: "frozen hour curious thunder relief accuse soccer region resource marine juice chicken",
    countryCode: "IN"
  },
  fees: {
    send: 0.001,
    inTransfer: 0.001,
    outTransfer: 0.001,
    viewRequest: 0,
    verifyViewRequest: 0,
    updateIssueLimit: 0,
    registerEmployee: 0,
    registerPendingEmployee: 0,
    registerUser: 0
  },
  centralServerHash: config.centralServerHash,
  links: {
    verifyLink: config.centralServer + "/payroll_structured/Views/Verify/verify.html",
    registerEmp: config.centralServer + "/payroll_structured/Token_generator/token.html",
    centralserver: nodeServer
  },
}
