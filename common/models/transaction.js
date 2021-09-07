'use strict';

const logger = require('../utils/logger').logger;
const BridgeABI = require('../abi/bridge.json');
const config = require('./config.json');
const constants = require('./constants');
const {getWeb3} = require('../utils/web3')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = function (Transaction) {
  Transaction.observe('before save', function (ctx, next) {
    if (ctx.isNewInstance) {
      ctx.instance.createdAt = new Date();
      ctx.instance.updatedAt = ctx.instance.createdAt;
    } else {
      ctx.data.updatedAt = new Date();
    }
    next();
  });

  Transaction.syncTx = async function (cfg) {
    logger.info('syncTx: start syncing chain id', cfg.id);

    let web3 = getWeb3(cfg.rpcs);
    let currentBlock = await web3.eth.getBlockNumber();
    let syncingBlock = await Transaction.app.models.Status.getSyncingBlock(cfg);
    let toBlock = syncingBlock + cfg.step - 1 < currentBlock ? syncingBlock + cfg.step - 1 : currentBlock;
    logger.info('syncTx: last sync', cfg.id, syncingBlock);

    const bridge = new web3.eth.Contract(BridgeABI, cfg.address.bridge);

    while (true) {
      try {
        logger.info('syncTx: sync chain', cfg.id, 'from', syncingBlock, 'to', toBlock);
        let events = await bridge.getPastEvents('Transfer', {fromBlock: syncingBlock, toBlock: toBlock});
        logger.info('syncTx: events.length:', events.length);
        for (const e of events) {
          Transaction.findOrCreate({fromChainID: cfg.id, fromTxHash: e.transactionHash}, {
            fromChainID: cfg.id,
            fromTxHash: e.transactionHash,
            fromAddress: e.returnValues.from,
            toChainID: e.returnValues.toChainID,
            toTxHash: '',
            toAddress: e.returnValues.to,
            amount: e.returnValues.amount,
            displayAmount: web3.utils.fromWei(e.returnValues.amount),
            status: constants.STATUS_CONFIRMING,
            timestamp: e.returnValues.timestamp,
            block: e.blockNumber
          });
        }

        syncingBlock = toBlock + 1;
        await Transaction.app.models.Status.upsert({'key': cfg.name + 'SyncingBlock', value: syncingBlock});
        if (toBlock === currentBlock) {
          await sleep(5 * 1000);
          currentBlock = await web3.eth.getBlockNumber();
        } else await sleep(500);
        toBlock = syncingBlock + cfg.step - 1 < currentBlock ? syncingBlock + cfg.step - 1 : currentBlock;
      } catch (e) {
        logger.error('syncTx: err:', e);
        await sleep(10 * 1000);
      }
    }
  }

  Transaction.confirmTx = async function (cfg) {
    logger.info('confirmTx: start confirming chain id', cfg.id);

    while (true) {
      try {
        let txns = await Transaction.find({where: {fromChainID: cfg.id, status: constants.STATUS_CONFIRMING}});
        logger.info(`confirmTx: txns.length of chain ${cfg.id}: ${txns.length}`);
        if (txns.length > 0) {
          let web3 = getWeb3(cfg.rpcs);
          let currentBlock = await web3.eth.getBlockNumber();
          for (let txn of txns) {
            let rawTx = await web3.eth.getTransaction(txn.fromTxHash);
            if (rawTx.blockNumber + 12 > currentBlock) {
              logger.info(`confirmTx: ${txn.fromTxHash} ${currentBlock - rawTx.blockNumber} not enough confirmation`);
              break;
            }
            txn.status = constants.STATUS_TRANSFERRING;
            await Transaction.upsert(txn);
          }
        }
        await sleep(5 * 1000);
      } catch (e) {
        logger.error('confirmTx: err:', e);
        await sleep(10 * 1000);
      }
    }
  }

  Transaction.scanning = async function () {
    for (let id in config.network) {
      const cfg = config.network[id];
      Transaction.syncTx(cfg);
      Transaction.confirmTx(cfg);
    }
  }
};
