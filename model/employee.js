module.exports = {

    name: 'employees',
    fields: [
        {
            name: 'email',
            type: 'String',
            length: 255,
        },
        {
            name: 'empid',
            type: 'String',
            length: 255
        },
        {
            name: 'name',
            type: 'String',
            length: 255,
        },
        {
            name: 'identity',
            type: 'String',
            length: 1000,
        },
        {
            name: 'iid',
            type: 'String',
            length: 1000,
        },
        {
            name: 'extra',
            type: 'String',
            length: 1000
        },
        {
            name: 'walletAddress',
            type: 'String',
            length: 255,
        },
        {
            name: 'department',
            type: 'String',
            length: 255,
        },
        {
            name: 'deleted',
            type: 'String',
            length: 255,
        }
    ]
}