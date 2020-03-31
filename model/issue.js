module.exports = {
    name: "issues",
    fields: [
        {
            name: 'pid',
            type: 'String', 
            length: 255,
            primary_key: true
        },
        {
            name: 'iid',
            type: 'String', 
            length: 255,
        },
        {  
            name: 'hash',
            type: 'String', 
            length: 255,
        },
        {
            name: 'sign',
            type: 'String',
            length: 255,
        },
        {
            name: 'publickey',
            type: 'String',
            length: 255,
        },
        {
            name: 'timestampp',
            type: 'Number',
            length: 255
        },
        {
            name :'status',
            type:'String',
            length: 255
        },
        {
            name: 'authLevel',
            type: 'Number',
            length: 255
        },
        {
            name: 'empid',
            type: 'String',
            length: 255
        },
        {
            name: 'transactionId',
            type: 'String',
            length: 255
        },
        {
            name: 'did',
            type: 'String',
            length: 255
        },
        {
            name: 'data',
            type: 'String',
            length: 255
        }
    ]
}
