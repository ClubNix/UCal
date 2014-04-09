var config = {};


config.client = {};
config.client.dimension = {};
config.client.dimension.url = 'http://localhost:8080';
config.client.dimension.version = '*';
config.client.uconf = {};
config.client.uconf.url = 'http://localhost:9000';
config.client.uconf.version = '*';
config.client.esiee = {};
config.client.esiee.url = 'http://www.esiee.fr';

config.uconf = {};
config.uconf.domain = 'edu.esiee.fr';


config.web = {};
config.web.port = process.env.WEB_PORT || 3000;

module.exports = config;

