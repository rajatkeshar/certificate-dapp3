module.exports = {
  verifyViewRequest: async function(requesterWalletAddress, assetId, countryCode) {
    app.sdb.lock('requester.verifyViewRequest' + assetId)
    var req = await app.model.Requester.findOne({
        condition: {
            requesterWalletAddress: requesterWalletAddress,
            assetId: assetId
        }
    });
    app.sdb.update('Requester', { ownerWalletAddress: this.trs.senderId + countryCode }, {trsId: req.trsId});
    app.sdb.update('Requester', {ownerTrsTimestamp: new Date().getTime()}, {trsId: req.trsId});
    app.sdb.update('Requester', { ownerStatus: "true" }, {trsId: req.trsId});
    app.sdb.update('Requester', { ownerTrsId: this.trs.id }, {trsId: req.trsId});
  },
  ownerGrantAsset: async function(requesterWalletAddress, assetId, countryCode) {
    app.sdb.lock('requester.ownerGrantViewers' + assetId)
    app.sdb.create('Requester', {
      ownerWalletAddress: this.trs.senderId + countryCode,
      requesterWalletAddress: requesterWalletAddress,
      ownerStatus: "true",
      assetId: assetId,
      ownerTrsId: this.trs.id,
      trsId: this.trs.id,
      initBy: "owner",
      trsTimestamp: new Date().getTime(),
      ownerTrsTimestamp: new Date().getTime()
    })
  }
}
