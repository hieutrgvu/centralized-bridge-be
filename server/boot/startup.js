'use strict';

module.exports = async function (app) {
  const {Transaction} = app.models;
  try {
    Transaction.scanning();
  } catch (e) {
    console.log(e)
  }
};
