module.exports = {
    name: "deplevels",
    fields: [
        {
            name: 'id',
            type: 'String',
            length: 255,
            primary_key: true
        },
        {
            name: 'department',
            type: 'String',
            length: 255,
        },
        {
            name: 'designation',
            type: 'String',
            length: 255
        },
        {
            name: 'priority',
            type: 'Number',
            length: 255
        }
    ]
}
