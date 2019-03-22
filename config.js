const config = Object.freeze({
  USER_PATH: process.env.USER_PATH,
  INTERFACE: process.env.INTERFACE,
  MODULE_ID: process.env.MODULE_ID,
  MODULE_TYPE: process.env.MODULE_TYPE,
  MODULE_INFO: process.env.MODULE_INFO,
  MQTT: {
    brokerAddress: process.env.MQTT_BROKER,
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    rejectUnauthorized: process.env.MQTT_REJECT_UNAUTHORIZED === 'true'
  },
  ZWAVE: {
    database: process.env.ZWAVE_DATABASE,
    networkKey: process.env.ZWAVE_NETWORK_KEY
  }
});

module.exports = config;
