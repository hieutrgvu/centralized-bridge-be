'use strict';

const logger = require('../utils/logger').logger;
const Web3 = require('web3');
const BridgeABI = require('../abi/bridge.json');
const {addresses} = require('./config.json');
const constants = require('./constants');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = function (Transaction) {
  Transaction.observe('before save', function (ctx, next) {
    if (ctx.isNewInstance) {
      ctx.instance.createdAt = new Date();
      ctx.instance.updatedAt = new Date();
    } else {
      ctx.data.updatedAt = new Date();
    }
    next();
  });

  Transaction.txProduce = async function () {
    const mumbaiChainID = 80001;
    let web3 = new Web3('https://rpc-mumbai.maticvigil.com');
    const bridge = new web3.eth.Contract(BridgeABI, addresses.polygon.bridge);
    bridge.getPastEvents('Transfer', {
      fromBlock: 18567825,
      toBlock: 18568825
    }).then(function (events) {
      for (const e of events) {
        console.log(e);
        Transaction.create({
          fromChainID: mumbaiChainID,
          fromTxHash: e.transactionHash,
          fromAddress: e.returnValues.from,
          toChainID: e.returnValues.toChainID,
          toTxHash: '',
          toAddress: e.returnValues.to,
          amount: e.returnValues.amount,
          displayAmount: web3.utils.fromWei(e.returnValues.amount),
          status: constants.STATUS_CONFIRMING,
          timestamp: e.returnValues.timestamp
        });
      }
    });

  }

  Transaction.scanning = async function () {
    while (true) {
      try {
        console.log('start scanning')
        await Transaction.txProduce();
      } catch (e) {
        logger.error(e);
      }
      await sleep(10 * 1000);
    }
  }
};
