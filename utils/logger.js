var log4js = require( "log4js" );
log4js.configure({
  appenders: { dappLogs: { type: 'dateFile', filename: './logs/PayrollDapp/dappLogs.log', daysToKeep: 1 } },
  categories: { default: { appenders: ['dappLogs'], level: 'info' } }
});
module.exports = log4js.getLogger( "dappLogs" );