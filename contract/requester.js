module.exports = {
  viewRequest: async function(assetId, countryCode) {
    app.sdb.lock('requester.viewRequest@' + assetId)
    console.log("trs: ", this.trs);
    app.sdb.create('Requester', {
      requesterWalletAddress: this.trs.senderId + countryCode,
      assetId: assetId,
      trsId: this.trs.id,
    })
  }
}
