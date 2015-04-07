exports.initStream = function(req, res, closeCb){
  'use strict';
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  });

  res.write(':' + new Array(2049).join(' ') + '\n'); // 2kB padding for IE
  res.write('retry: 2000\n');

  res.write('event: subscribed\n');
  res.write('data: \n\n');

  var handle = setInterval(function() {
    res.write('\n');
  }, 30 * 1000);

  //clean up
  req.on('close', function() {
    console.log('Request closed');
    closeCb();
    clearInterval(handle);
  });
};
