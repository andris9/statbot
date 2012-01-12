var cluster = require('cluster'),
    fetch = require("fetch"),
    EventEmitter = require('events').EventEmitter,
    utillib = require("util"),
    fs = require("fs");


module.exports = StatBot;

function StatBot(options){
    EventEmitter.call("this");
    
    options = options || {};
    options.childProcesses = options.childProcesses || 5;
    options.timeout = options.timeout || 10;
    
    this.options = options;
    this.serverList = [];
    this.workers = {};
    
    this.toBeProcessed = 0;
    this.workerCount = 0;
    this.processedCount = 0;
    
    this.startTimer = Date.now();
    
    if(cluster.isMaster){
        process.nextTick(this.runMaster.bind(this));
    }else{
        process.nextTick(this.runChild.bind(this));
    }
}
utillib.inherits(StatBot, EventEmitter);


StatBot.prototype.handleChildEnd = function(worker){
    if(this.workers[worker.pid].url){
        this.emitURLData({url:this.workers[worker.pid].url, error:"Child crashed"});
    }
    
    if(this.options.debug){
        console.log("WORKER DIED "+worker.pid);
    }
    
    this.workers[worker.pid] = null;
    this.workerCount--;
    
    if(!this.done && this.workerCount < this.options.childProcesses){
        this.addChild();
    }
}

StatBot.prototype.addChild = function(){
    var worker;
    
    if(!this.serverList.length){
        return;
    }
    
    var worker = cluster.fork();
    this.workers[worker.pid] = {worker: worker};
    this.workerCount++;
    
    if(this.options.debug){
        console.log("ADDED WORKER "+worker.pid);
    }
    
    worker.on("message", (function(msg) {
        switch(msg && msg.command){
            case "getUrl": this.sendURL(worker);
                break;
            case "response": this.handleResponse(worker, msg.data);
                break;
        }
    }).bind(this));
    
}

//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/array/shuffle [v1.0]
StatBot.prototype.arrayShuffle = function(o){
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}

StatBot.prototype.handleResponse = function(worker, data){
    var keys = 0;
    
    this.workers[worker.pid].url = null;
    
    this.emitURLData(data);

    this.processedCount++;
    
    if(this.processedCount >= this.toBeProcessed){
        this.done = true;
        
        keys = Object.keys(this.workers);
        
        for(var i=0, len=keys.length; i<len; i++){
            if(this.workers[keys[i]] && this.workers[keys[i]].worker){
                this.workers[keys[i]].worker.kill();
            }
        }
       
        this.endTimer = Date.now();
       
        process.nextTick(this.emit.bind(this,"end", this.endTimer - this.startTimer));
        
    }
}

StatBot.prototype.runMaster = function(){
    cluster.on('death', (function(worker) {
        if(this.workers[worker.pid]){
            this.handleChildEnd(worker);
        }
    }).bind(this));
    
    this.emit("links", (function(links){
        this.startTimer = Date.now();
        this.serverList = this.arrayShuffle(links);
        this.toBeProcessed += links.length;
        this.handleLinks();
    }).bind(this));

}

StatBot.prototype.handleLinks = function(){
    for(var i=0, len=this.options.childProcesses; i<len; i++){
        this.addChild();
    }
}

StatBot.prototype.emitURLData = function(data){
    if(data && data.url){
        this.emit("url", data);
    }
}

StatBot.prototype.sendURL = function(worker){
    if(this.serverList.length){
        var url = this.serverList.pop();
        this.workers[worker.pid].url = url;
        process.nextTick(worker.send.bind(worker, {url: url}));
        if(this.options.debug){
            console.log("SENT TO WORKER "+worker.pid+" "+url);
        }
    }else{
        if(this.options.debug){
            console.log("KILLING "+worker.pid);
        }
        process.nextTick(worker.kill.bind(worker));
    }
}

StatBot.prototype.runChild = function(){
    
    process.on("message", (function(msg){
        if(this.options.debug){
            console.log(process.pid + " RECEIVED " + JSON.stringify(msg));
        }
        if(msg && msg.url){
            this.processURL(msg.url);
        }
    }).bind(this));
    
    if(this.options.debug){
        console.log(process.pid + " SENT BACK " + JSON.stringify({command: "getUrl"}));
    }
    process.nextTick(process.send.bind(process,{command: "getUrl"}));
    
}

StatBot.prototype.processURL = function(url){
    handleUrl(url, {timeout: this.options.timeout}, (function(err, meta){
        var response = {};
        if(err){
            response = {command: "response", data: {
                url: url,
                error: err.message || err
            }};
            process.send(response);
            if(this.options.debug){
                console.log(process.pid + " SENT BACK " + JSON.stringify(response));
                console.log(process.pid + " GOING TO DIE");
            }
            process.exit(); // die on error
        }else{
            response = {command: "response", data: {
                url: url,
                meta: meta
            }}
            if(this.options.debug){
                console.log(process.pid + " SENT BACK " + JSON.stringify(response));
            }
            process.send(response);
        }
        
        if(this.options.debug){
            console.log(process.pid + " SENT BACK " + JSON.stringify({command: "getUrl"}));
        }
        process.nextTick(process.send.bind(process,{command: "getUrl"}));
        
    }).bind(this));
}


function handleUrl(url, options, callback){
    var done = false,
        timeout = setTimeout(function(){
            if(!done){
                done = true;
                callback(new Error("Timeout"));
            }
        }, options.timeout * 1000);
    
    fetch.fetchUrl(
        url,
        {
            maxResponseLength: 50*1048, 
            disableDecoding: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_2) AppleWebKit/535.2 (KHTML, like Gecko) Chrome/15.0.874.120 Safari/535.2',
                'Accept-Language':'et-EE,et;q=0.8,en-US;q=0.6,en;q=0.4',
                'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Charset':'windows-1257,utf-8;q=0.7,*;q=0.3'
            }
        }, 
        function(err, meta, body){
            clearTimeout(timeout);
            if(done){
                return
            };
            done = true;
            if(err){
                return callback(err);
            }
            
            body = body.toString().replace(/\r?\n/g,"\u0000");
            
            // document type
            var dtd = body.match(/<\!DOCTYPE[^>]*>/i),
                dtdname = (dtd && dtd[0] || "").replace(/[\u0000\s]+/g, " ");
            if(dtdname){
                meta.doctype = {
                    doctype: dtdname,
                    pos: dtd.index
                }
            }
            
            if(meta.cookieJar){
                meta.cookieJar = meta.cookieJar.cookies || {};
            }
            
            // charset
            var metaList = body.match(/<meta ([^>]*?)>/gi),
                charset = "";
            if(metaList){
                for(var i=0, len=metaList.length; i<len; i++){
                    if(metaList[i].match(/http-equiv\s*=\s*['"]\s*content-type\s*['"]/i)){
                        ct = metaList[i].match(/content\s*=\s*['"]([^'"]+)['"]/i)
                        ct = (ct && ct[1] && ct[1].split(";").pop() || "").replace(/[\u0000\s]+/g, " ").trim().toUpperCase();
                        if(ct && (ct = ct.split("=").pop())){
                            charset = ct;
                            break;
                        }
                    }else if((ct = metaList[i].match(/<meta charset\s*=\s*['"]?([^'"\/>]+)['"]?/i))){
                        ct = (ct && ct[1] || "").replace(/[\u0000\s]+/g, " ").trim().toUpperCase();
                        if(ct){
                            charset = ct;
                            break;
                        }
                    }
                }
            }
            if(charset){
                meta.charset = charset;
            }
            
            callback(null, meta);
        });
}
