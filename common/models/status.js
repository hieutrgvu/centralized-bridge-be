'use strict';

module.exports = function (Status) {
  Status.getSyncingBlock = async function (cfg) {
    return new Promise((resolve, reject) => {
      Status.dataSource.connector.execute(
        `select "value" as syncingBlock
         from status
         where "key" = '${cfg.name + 'SyncingBlock'}'`,
        (err, result) => {
          if (err) reject(err);
          else resolve(result[0] === null ? result[0].syncingBlock : null);
        });
    });
  }
}
