'use strict';

module.exports = function (Status) {
  Status.getSyncingBlock = async function (cfg) {
    let result = await Status.findById(cfg.name + 'SyncingBlock');
    const block = result === null ? null : Number(result.value);
    return block || cfg.syncingBlock;
  }
}
