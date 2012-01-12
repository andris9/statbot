var StatBot = require("./../index"),
    fetch = require("fetch");

var total = 0,
    processed = 0,
    errors = 0,
    encodings = {};

var stats = new StatBot({debug: false, childProcesses: 10});

stats.on("links", function(callback){
    

    fetch.fetchUrl("http://tahvel.info/test/serverid.php", function(err, meta, body){
        var servers = [];
            
        if(err){
            console.log("ERROR RETRIEVING URL LIST");
            process.exit();
        }

        try{
            servers = JSON.parse((body || "").toString("utf-8").trim());
        }catch(err){
            console.log("ERROR PARSING URL LIST");
            process.exit();
        }

        servers = servers.slice(0,50);

        total = servers.length;
        console.log("Processing " + total + " links");
        callback(servers);
    });
    
});

stats.on("url", function(data){
    var charset;
    
    if(data && data.meta){
        processed++;
        
        charset = detectCharset(data.meta.responseHeaders);
        
        if(!charset){
            charset = data.meta.charset;
        }
        if(!charset){
            charset="UNKNOWN";
        }
        if(!encodings[charset]){
            encodings[charset] = 0;
        }
        encodings[charset]++;
    }else{
        errors++;
    }
     
});

stats.on("end", function(time){
    var keys = Object.keys(encodings),
        list = [];
       
    for(i=0; i<keys.length; i++){
        list.push({encoding: keys[i], count: encodings[keys[i]]});
    }
    list.sort(function(a,b){
        return b.count - a.count;
    });
   
    for(var i=0; i<list.length; i++){
        console.log((i+1)+"\t"+list[i].encoding+"\t"+list[i].count);
    }
   
    console.log("Processed: "+processed+" links in "+ (time/1000)+" sec");
    console.log("Errors: ", errors);
    
});



function detectCharset(responseHeaders){
    if(!responseHeaders || !responseHeaders['content-type']){
        return false;
    }
    var parts = responseHeaders['content-type'].split(";"),
        parts2;
    for(var i=0; i<parts.length; i++){
        parts2 = parts[i].split("=");
        if(parts2[0].trim().toLowerCase()=="charset"){
            return parts2[1].trim().toUpperCase();
        }
    }
    return false;
}