'use strict';

$(function() {
  /* global alert,EventSource */

  var vizArea = $('#viz-area'),
    layout,
    eventChangeSource,
    scxmlChangeSource;

  getScxml();

  function getScxml() {
    $.ajax({
        type: 'GET',
        url: '../',
        dataType: 'text'
      })
      .done(function(data, status, xhr) {
        if (status !== 'success') {
          alert('Error retrieving scxml content:', status);
          console.log(xhr);
          return;
        }
        drawSimulation(data);
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

  function drawSimulation(content) {
    try {
      var doc = (new DOMParser()).parseFromString(content, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) {
        throw ({
          //Only div in parsererror contains the error message
          //If there is more than one error, browser shows only the first error
          message: $(doc).find('parsererror div').html()
        });
      }

      if (layout) {
        layout.unhighlightAllStates();

        layout.update(doc).done(null, function(err) {
          if (err) {
            alert('Something went wrong: ', err.message);
            console.log(err);
            return;
          }
        });
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
      }

      layout.initialized.then(function(err) {
        if (err) {
          alert('Error initializing visualization:', err.message);
          console.log(err);
          return;
        }

        layout.fit();

        if (!eventChangeSource) {
          eventChangeSource = new EventSource('./_changes');

          eventChangeSource.addEventListener('onEntry', function(e) {
            highlight('onEntry', e.data);
          }, false);

          eventChangeSource.addEventListener('onExit', function(e) {
            highlight('onExit', e.data);
          }, false);
        }

        if(!scxmlChangeSource) {
          scxmlChangeSource = new EventSource('../_changes');

          scxmlChangeSource.addEventListener('onChange', function(e) {
            getScxml();
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

            configuration.forEach(highlight.bind(this, 'onEntry'));
          });
      }).done();
    } catch (e) {
      alert('Error parsing scxml content:', e.message);
      console.log(e);
    }
  }
});
