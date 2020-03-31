module.exports = {
    name: "departments",
    fields: [
        {
            name: 'did',
            type: 'String',
            length: 255,
            primary_key: true
        },
        {
            name: 'name',
            type: 'String',
            length: 255,
        },
        {
            name: 'levels',
            type: 'Number', 
            length: 255
        }    
    ]
}
