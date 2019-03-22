const config = require('../config');
const mqtt = require('./mqtt-client');
const OZW = require('openzwave-shared');
const fs = require('fs');
const trycatch = require('trycatch');

////////////////////////////////////////////////////////////////////////////////
/// Init
////////////////////////////////////////////////////////////////////////////////

const zwave = new OZW({
    UserPath: config.USER_PATH,
    Logging: true,
    ConsoleOutput: false,
    NetworkKey: config.ZWAVE.networkKey,
    PollInterval: 1000,
    Associate: true,
    ConfigPath: config.ZWAVE.database,
    SaveConfiguration: true
});

if (!fs.existsSync(config.INTERFACE)) {
  console.error('Specified interface does not exist');
  process.exit(1);
}

zwave.connect(config.INTERFACE);

let mqttLock = true;

////////////////////////////////////////////////////////////////////////////////
/// Z-Wave events
////////////////////////////////////////////////////////////////////////////////

zwave.on('scan complete', () => {
    mqttLock = false;
    mqtt.publish('moduleManagement', 'availabilityChange', { available: true });
});
zwave.on('driver failed', () => {
  mqtt.publish('Z-Wave', 'driver failed', null)
    .then(() => mqtt.publish('moduleManagement', 'stateChange', { state: 'disconnected' }))
    .then(() => {
        zwave.disconnect(config.INTERFACE);
        mqtt.end()
          .then(() => process.exit(1));
    });
});
zwave.on('node added', (nodeId) => mqtt.publish('Z-Wave', 'node added', { nodeId }));
zwave.on('node removed', (nodeId) => mqtt.publish('Z-Wave', 'node removed', { nodeId }));
zwave.on('node ready', (nodeId, { manufacturer, product, type }) =>
    mqtt.publish('Z-Wave', 'node ready', { nodeId, manufacturer, product, type })
);
zwave.on('value added', (nodeId, comClass, valueId) =>
    mqtt.publish('Z-Wave', 'value added', {
      nodeId,
      name: valueId.label,
      value: valueId.value,
      units: valueId.units,
      help: valueId.help,
      writable: !valueId.read_only,
      possibleValues: valueId.values,
      valueId: valueId.value_id
    })
);
zwave.on('value changed', (nodeId, comClass, valueId) =>
    mqtt.publish('Z-Wave', 'value changed', {
      nodeId,
      valueId: valueId.value_id,
      value: valueId.value,
      polled: valueId.is_polled
    })
);
zwave.on('node event', (nodeId, data) =>
    mqtt.publish('Z-Wave', 'BASIC SET received', {
      nodeId,
      value: data
    })
);

process.on('SIGTERM', () => {
  zwave.disconnect(config.INTERFACE);
  mqtt.publish('moduleManagement', 'stateChange', { state: 'disconnected' })
    .then(() => mqtt.end())
    .then(() => process.exit());
});

////////////////////////////////////////////////////////////////////////////////
/// Requests
////////////////////////////////////////////////////////////////////////////////

mqtt.emitter.on('request', ({ topic, request }) => {
  switch (topic) {
    case `${config.MODULE_ID}/Z-Wave`:{
      if (mqttLock) return;
      resolveZwaveRequest(request);
      break;
    }
    case `${config.MODULE_ID}/moduleManagement`:{
      resolveManagementRequest(request);
      break;
    }
    case 'allModules':{
      resolveAllModulesRequest(request);
      break;
    }
  };
});

const resolveAllModulesRequest = function (request) {
  switch (request.request) {
    case 'identifyModule': {
      mqtt.publish('moduleManagement', 'moduleIdentify', { info: config.MODULE_INFO, available: true, type: config.MODULE_TYPE });
      break;
    }
  };
};

const resolveManagementRequest = function (request) {
  const par = request.parameters;

  switch (request.request) {
    case 'restartModule': {
      mqtt.publish('moduleManagement', 'stateChange', {state: 'disconnected'})
        .then(() => mqtt.end())
        .then(() => process.exit(123));
      break;
    }
  };
};

function resolveZwaveRequest(request) {
  const par = request.parameters;
  const parseValueId = (valueId) => {
    const map = ['node_id', 'class_id', 'instance', 'index'];
    return valueId.split('-').reduce((object, item, index) => {
        object[map[index]] = Number(item);
        return object;
    }, {});
  };

  switch (request.request) {
    case 'addNode': {
      zwave.addNode(true);
      break;
    }
    case 'removeNode': {
      zwave.removeNode();
      break;
    }
    case 'setValue': {
      trycatch(() => zwave.setValue(parseValueId(par.valueId), par.value),
        console.error);
      break;
    }
    case 'softReset': {
      zwave.softReset();
      break;
    }
    case 'hardReset': {
      zwave.hardReset();
      break;
    }
    case 'enablePoll': {
      trycatch(() => zwave.enablePoll(parseValueId(par.valueId), par.intensity),
        console.error);
      break;
    }
    case 'disablePoll': {
      trycatch(() => zwave.disablePoll(parseValueId(par.valueId)),
        console.error);
      break;
    }
    case 'getPollIntensity': {
      trycatch(() => {
        const poll = zwave.getPollIntensity(parseValueId(par.valueId));
        mqtt.publish('Z-Wave', 'response', { request: 'getPollIntensity', requestParams: par, response: poll });
      },
      console.error);
      break;
    }
  }
};
