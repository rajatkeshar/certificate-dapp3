module.exports = {
  viewRequest: async function(assetId, countryCode) {
    app.sdb.lock('requester.viewRequest@' + assetId)
    console.log("trs: ", this.trs);
    app.sdb.create('Requester', {
      requesterWalletAddress: this.trs.senderId + countryCode,
      assetId: assetId,
      trsId: this.trs.id,
      initBy: "requester",
      trsTimestamp: new Date().getTime()
    })
  },
  authorizeByIssuer: async function(assetId, countryCode) {
    app.sdb.lock('requester.authorizeByIssuer@' + assetId)
    console.log("trs: ", this.trs);
    var req = await app.model.Requester.findOne({
        condition: {
            requesterWalletAddress: this.trs.senderId + countryCode,
            assetId: assetId
        }
    });
    console.log("req: ", req);
    app.sdb.update('Requester', {isAuthorizeByIssuer: "true"}, {trsId: req.trsId});
  }
}
