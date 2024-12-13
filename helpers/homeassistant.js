import {
  getAuth,
  createLongLivedTokenAuth,
  createConnection,
  ERR_HASS_HOST_REQUIRED,
} from 'home-assistant-js-websocket';
import config from '../config.js';

class HomeAssistant {
  constructor() {
    this.hassioUrl = config.hassioUrl;
    this.token = config.hassioToken;
  }
  async connectSocket() {
    let auth;
    try {
      auth = await createLongLivedTokenAuth(this.hassioUrl, this.token);
    } catch (err) {
      if (err === ERR_HASS_HOST_REQUIRED) {
        auth = await getAuth({ hassUrl: this.hassioUrl });
      } else {
        alert(`Unknown error: ${err}`);
        return;
      }
    }
    const connection = await createConnection({ auth });
    return connection;
  }
}
export default HomeAssistant;
