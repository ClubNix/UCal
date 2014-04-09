var restify = require('restify');
var async   = require('async');
var express = require('express');
var request = require('request');

var config = require('./config')

var app = express();

var dimension_client = restify.createJsonClient({
  url: config.client.dimension.url,
  version: config.client.dimension.version
});

var uconf_client = restify.createJsonClient({
  url: config.client.uconf.url,
  version: config.client.uconf.version
})

var esiee_client = restify.createStringClient({
  url: config.client.esiee.url
})

function filter_resources(array, category) {
  return array.filter(function(element, index, array) {
    return element.category == category;
  }).map(function(element) {
    return element.name;
  });
}

var generate_resources_description = function (resources, name, no_elements_statement) {
  return resources.length > 0 ? name + (resources.length != 1 ? 's' : '') +  ': ' + resources.join('\\, ') + '\\n' : no_elements_statement;
}

function events_render_ics(events) {
  events = events.map(function(entry) {
    entry.categories = entry.activityName.replace(/:/g,',');
    entry.startDate  = entry.startDate.replace(/\.000Z/g,'Z').replace(/[-:\.]/g,'');
    entry.endDate    = entry.endDate.replace(/\.000Z/g,'Z').replace(/[-:\.]/g,'');
    
    entry.description = '';
    
    var units       = filter_resources(entry.resources, 'category6').sort();
    var trainees    = filter_resources(entry.resources, 'trainee').sort();    
    var classrooms  = filter_resources(entry.resources, 'classroom').sort();
    var instructors = filter_resources(entry.resources, 'instructor').sort();

    entry.description += generate_resources_description(units, 'Unité', '');
    entry.description += generate_resources_description(trainees, 'Groupe', '');
    entry.description += generate_resources_description(classrooms, 'Salle', 'Pas de salle\\n');
    entry.description += generate_resources_description(instructors, 'Intervenant', 'Heures non surveillées\\n');
    
    entry.location = classrooms.join('\\, ');
    
    return entry;
  });

  var output = '';
  output += "BEGIN:VCALENDAR\n";
  output += "VERSION:2.0\n";
  output += "METHOD:REQUEST\n";
  output += "PRODID:-//clubnix//lewinp v1.0//EN\n";
  output += "CALSCALE:GREGORIAN\n";
  events.forEach(function(entry) {
    output += "BEGIN:VEVENT\n";
    output += "SUMMARY:" + entry.activityName + "\n";
    output += 'CATEGORIES:' + entry.categories + "\n";
    output += "DTSTART:" + entry.startDate + "\n";
    output += "DTEND:" + entry.endDate + "\n";
    
    if(entry.location.length > 0) {
      output += 'LOCATION:' + entry.location + "\n";
    }
    
    output += "DESCRIPTION:" + entry.description + "\n";
    output += "END:VEVENT\n";
  });
  output += "END:VCALENDAR\n";
  
  return output;
}

app.get('/ping', function(req, res){
  res.send('pong');
});

function fetch_user_ade_conf(user, callback) {
  esiee_client.get('/~' + user + '/ade.txt', function (err, req, res, obj) {
    if(err) callback(err, null);
    else callback(null, obj.trim());
  });
}

function fetch_user_uconf(user, callback) {
  uconf_client.get('/api/getUserConfig/' + user + "@" + config.uconf.domain, function(err, req, res, obj) {
    if(err) callback(err, null);
    else callback(null, obj.resources);
  });
}

function fetch_user_events(user, fetch_method, callback) {
  async.waterfall([
    function(next) {
      fetch_method(user, next);
    },
    function(arg1, next) {
      args = arg1.split(',').join('_');
      dimension_client.get('/api/resource-hierarchy/' + args, function (err, req, res, obj) {
        next(err, obj.resources);
      });
    },
    function(arg1, next){
      dimension_client.get('/api/events/with-resources/' + arg1.join('_'), function (err, req, res, obj) {
        next(err, obj.events);
      });
    }
  ], callback);
  
}

app.get('/ucal/u/:user', function(req, res){
  fetch_user_events(req.params.user, fetch_user_ade_conf, function (err, result) {
    if(err) {
      res.send(err);
    } else {
      res.send(events_render_ics(result));
    }
  });
});
app.get('/ucal/m/:user', function(req, res) {
  fetch_user_events(req.params.user, fetch_user_uconf, function (err, result) {
    if(err) {
	  res.send(err);
    } else {
      res.send(events_render_ics(result));
    }
  });
});
app.get('/ucal/u/:user/json', function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");

  fetch_user_events(req.params.user, fetch_user_ade_conf, function (err, result) {
    if(err) {
      res.send(err);
    } else {
      res.send(result);
    }
  })
});
app.get('/ucal/m/:user/json', function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");

  fetch_user_events(req.params.user, fetch_user_uconf, function (err, result) {
    if(err) {
      res.send(err);
    } else {
      res.send(result);
    }
  })
});

var server = app.listen(config.web.port);

