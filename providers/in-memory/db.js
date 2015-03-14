// this module implements a simple in-memory key-value store
// We shoudl be able to swap it out with other database back-ends

function Store(){
    this.memory = {}; 
}

Store.prototype.get = function(key){
    return this.memory[key];
}

Store.prototype.put = function(key, value){
    return this.memory[key] = value;
}

Store.prototype.del = function(key){
  var db = this,
    exists = !!this.memory[key];
  
  Object.keys(this.memory).forEach(function (element) {
    //Delete every children of provided key
    if(element.indexOf(key) !== -1) {
      delete db.memory[element];
    }
  });

  return exists;
}

module.exports.Store = Store;

