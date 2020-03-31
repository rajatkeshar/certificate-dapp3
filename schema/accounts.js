'use strict';

var constants = require('../utils/constants.js');

module.exports = {
  getBalance: {
    type: 'object',
    properties: {
      dappId: {
        type: "string",
        format: "publicKey"
      },
      address: {
        type: 'string',
        minLength: 1
      }
    },
    required: ['dappId', 'address']
  },
  open: {
    type: 'object',
      properties: {
        dappId: {
          type: "string",
          format: "publicKey"
        },
        secret: {
          type: "string",
          minLength: 1,
          maxLength: 100
        },
        countryCode: {
          type: 'string',
          minLength: 2,
          maxLength: 2
        }
      },
      required: ['dappId', 'secret', 'countryCode']
  }
};
