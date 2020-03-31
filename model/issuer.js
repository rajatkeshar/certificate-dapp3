module.exports = {
    name: "issuers",
    fields: [
        {  
            name: 'iid',
            type: 'String', 
            length: 255,
            primary_key: true
        },
        {
            name: 'publickey',
            type: 'String',
            length: 255,
        },
        {
            name: 'email',
            type: 'String',
            length: 255,
        },
        {
            name: 'timestampp',
            type: 'Number',
            length: 255
        },
        {
            name: 'deleted',
            type: 'String',
            length: 255,
        }
    ]
}
