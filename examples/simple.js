var StatBot = require("./../index");

var stats = new StatBot({debug: false});

stats.on("links", function(callback){
    
    callback(["http://www.neti.ee", "http://blog.tr.ee"]);
    
});

stats.on("url", function(data){
   console.log("INCOMING DATA", data); 
});

stats.on("end", function(){
   console.log("Processing ended"); 
});