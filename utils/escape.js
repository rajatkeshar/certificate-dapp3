module.exports.escapeQuotes = function(str){
    str = str.replace(/'/g, "ESCAPEDSINGLEQUOTE");
	str = str.replace(/"/g, "ESCAPEDDOUBLEQUOTE");
	return str;
}

module.exports.restoreQuotes = function(str){
    str = str.replace(/ESCAPEDSINGLEQUOTE/g, "'");
	str = str.replace(/ESCAPEDDOUBLEQUOTE/g, "\"");
}