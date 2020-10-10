module.exports = {
    name: "requesters",
    fields: [
        {
            name: 'assetId',
            type: 'String',
            length: 255,
        },
        {
            name: 'requesterWalletAddress',
            type: 'String',
            length: 255,
        },
        {
            name: 'ownerWalletAddress',
            type: 'String',
            length: 255,
        },
        {
            name: 'issuerWalletAddress',
            type: 'String',
            length: 255,
        },
        {
            name: 'ownerStatus',
            type: 'Boolean',
            default: false,
        },
        {
            name: 'issuerStatus',
            type: 'Boolean',
            default: false,
        },
        {
            name: 'initBy',
            type: 'String',
            length: 20,
        },
        {
            name: 'isAuthorizeByIssuer',
            type: 'Boolean',
            default: false,
        },
        {
            name: 'trsId',
            type: 'String',
            length: 255,
        },
        /*{
            name: 'ownerTrsId',
            type: 'String',
            length: 255,
        },
        {
            name: 'issuerTrsId',
            type: 'String',
            length: 255,
        }*/
    ]
}
