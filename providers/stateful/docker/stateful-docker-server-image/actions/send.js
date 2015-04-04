module.exports = function (event, options, eventsToSend) {
  var sendActionFn;
  switch(sendAction.event.type){
    case 'http://www.w3.org/TR/scxml/#SCXMLEventProcessor':
      eventsToSend.push({event : event, options : options});
      break;
    case 'http://www.w3.org/TR/scxml/#BasicHTTPEventProcessor':
      sendActionFn = function(){
        console.log('here1');
        request({
          method : 'POST',
          json : sendAction.event,
          url : sendAction.event.target
        },function(error, response, body ){
          console.log('here2',error, body);
          if(error){
            scionSandbox.gen({name : 'send.' + sendAction.options.sendid + '.got.error',  data : error}); 
          }else{
            scionSandbox.gen({
              name : 'send.' + sendAction.options.sendid + '.got.success', 
              data : {
                body : body,
                response : response
              }
            }); 
          }
        });
      };
      break;
    default:
      //TODO: error if io processor type is not supported
      break;
  }

  var delay = sendAction.options.delay;
  console.log('sendActionFn',sendActionFn);
  setTimeout(sendActionFn,delay || 1);    //TODO: store timeout in a timeout map to support <cancel>
};


