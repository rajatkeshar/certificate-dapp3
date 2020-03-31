var sleep = require('./sleep')
module.exports = async function(){
    var blockCount = await app.model.Block.count({});
    do{
        sleep(1000);
        var newCount = await app.model.Block.count({});
    }while(blockCount === newCount);
}