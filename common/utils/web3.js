const Web3 = require('web3');

module.exports = {
  getWeb3: function(rpcs) {
    const id = Math.floor(Math.random() * rpcs.length);
    return new Web3(new Web3.providers.HttpProvider(rpcs[id]));
  },
}
