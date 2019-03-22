const MQTT = require("async-mqtt");
const config = require('../config');
const { EventEmitter } = require('events');

const broker = config.MQTT.brokerAddress;
const moduleId = config.MODULE_ID;
const options = {
  clientId: moduleId,
  rejectUnauthorized: config.MQTT.rejectUnauthorized,
  username: config.MQTT.username,
  password: config.MQTT.password,
  will: {
    topic: 'moduleManagement',
    payload: JSON.stringify({ moduleId, type: 'stateChange', data: { state: 'disconnected' } }),
    qos: 2,
    retain: false
  }
};

const client = MQTT.connect(broker, options);

client.on('connect', () => {
    publish('moduleManagement', 'stateChange', { state: 'connected', info: config.MODULE_INFO, available: false, type: config.MODULE_TYPE })
      .then(() => client.subscribe(`${moduleId}/+`, { qos: 2 }))
      .then(() => client.subscribe('allModules', { qos: 2 }));
});

const emitter = new EventEmitter();
client.on('message', (topic, message) => emitter.emit('request', {
  topic,
  request: JSON.parse(message.toString())
 })
);

const publish = (topic, type, data) =>
  client.publish(topic, JSON.stringify({ moduleId, type, data }), { retain: false, qos: 2 });
const end = () => client.end();

module.exports = {
  emitter,
  publish,
  end
};
