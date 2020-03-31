module.exports = {
  viewRequest: async function(assetId) {
    app.sdb.lock('requester.viewRequest@' + assetId)
    console.log("trs: ", this.trs);
    app.sdb.create('Requester', {
      requesterWalletAddress: this.trs.senderId,
      assetId: assetId,
      trsId: this.trs.id,
    })
  }
}
