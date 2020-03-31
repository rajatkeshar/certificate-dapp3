module.exports = {
  verifyViewRequest: async function(requesterWalletAddress, assetId) {
    app.sdb.lock('requester.verifyViewRequest' + assetId)
    var req = await app.model.Requester.findOne({
        condition: {
            requesterWalletAddress: requesterWalletAddress,
            assetId: assetId
        }
    });
    app.sdb.update('Requester', { ownerWalletAddress: this.trs.senderId }, {trsId: req.trsId});
    app.sdb.update('Requester', { ownerStatus: "true" }, {trsId: req.trsId});
  }
}
