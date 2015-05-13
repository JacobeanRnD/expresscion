'use strict';

exports.initStream = function(req, res, closeCb){
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  });

  res.write(':' + new Array(2049).join(' ') + '\n'); // 2kB padding for IE
  res.write('retry: 2000\n');

  res.write('event: subscribed\n');
  res.write('data: \n\n');

  var handle = setInterval(function() {
    if(!res.finished)
      res.write('\n');
  }, 30 * 1000);

  //clean up
  res.on('close', function() {
    clearInterval(handle);
    closeCb();
  });
};
