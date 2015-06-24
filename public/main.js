'use strict';
// jshint: window: true
/* global alert,EventSource, $, vizType, _, window, DOMParser */

$(function() {
  var statechartUrl = '../';
  var statechartChangesUrl = '../_changes';

  if(vizType === 'statechart') {
    statechartUrl = './';
    statechartChangesUrl = './_changes';
  }

  var vizArea = $('#viz-area'),
    layout,
    eventChangeSource,
    scxmlChangeSource,
    isFirst = true;

  var updateLayout = _.debounce(function() {
    layout.invalidateSize();
  }, 500);

  window.addEventListener('resize', updateLayout, false);

  getScxml();

  function getScxml() {
    $.ajax({
        type: 'GET',
        url: statechartUrl,
        dataType: 'text'
      })
      .done(function(content, status, xhr) {
        if (status !== 'success') {
          alert('Error retrieving scxml content:', status);
          console.log(xhr);
          return;
        }
        
        drawSimulation(content, function () {
          if(isFirst) {
            layout.fit();
            isFirst = false;  
          }

          if(!scxmlChangeSource) {
            scxmlChangeSource = new EventSource(statechartChangesUrl);

            scxmlChangeSource.addEventListener('onChange', function() {
              getScxml();
            }, false);
          }

          if(vizType === 'statechart') {
            return;
          }

          if (!eventChangeSource) {
            eventChangeSource = new EventSource('./_changes');

            eventChangeSource.addEventListener('onEntry', function(e) {
              highlight('onEntry', e.data);
            }, false);

            eventChangeSource.addEventListener('onExit', function(e) {
              highlight('onExit', e.data);
            }, false);
          }

          $.ajax({
            type: 'GET',
            url: './',
            dataType: 'json'
          })
          .done(function(configuration, status, xhr) {
            if (status !== 'success') {
              alert('Error retrieving instance configuration:', status);
              console.log(xhr);
              return;
            }

            if(configuration.data.instance.snapshot) configuration.data.instance.snapshot.forEach(highlight.bind(this, 'onEntry'));
          });
        }, function (err) {
          alert(err.message);
        });
      });
  }

  function highlight(eventName, state) {
    if (Array.isArray(state)) {
      for (var eventIndex in state) {
        layout.highlightState(state[eventIndex], eventName === 'onEntry');
      }
    } else {
      layout.highlightState(state, eventName === 'onEntry');
    }
  }

  function drawSimulation(content, onDone, onError) {
    var doc = (new DOMParser()).parseFromString(content, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      return onError({ message: $(doc).find('parsererror div').html() });
    }

    if (layout) {
      layout.unhighlightAllStates();
      layout.update(doc).then(onDone, onError);
    } else {
      vizArea.empty();

      layout = new forceLayout.Layout({ // jshint ignore:line
        kielerAlgorithm: '__klayjs',
        parent: vizArea[0],
        doc: doc,
        textOnPath: false,
        routing: 'ORTHOGONAL',
        debug: false
      });

      layout.initialized.then(onDone, onError);
    }
  }
});
