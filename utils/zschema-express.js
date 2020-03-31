var z_schema = require('z-schema');
var ZSchema = new z_schema();

module.exports = {
  validate: async function(value, schema) {
    return new Promise((resolve, reject) => {
      ZSchema.validate(value, schema, function (err, valid) {
        if(err) reject(err[0].message + ": " + err[0].path);
        resolve(valid);
      });
    });
  }
};
