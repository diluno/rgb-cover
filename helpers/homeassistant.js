import {
  getAuth,
  createLongLivedTokenAuth,
  createConnection,
  ERR_HASS_HOST_REQUIRED,
} from 'home-assistant-js-websocket';

class HomeAssistant {
  constructor() {
    this.hassioUrl = 'http://homeassistant.local:8123';
    // this.hassioUrl = 'https://hassio.dil.uno';
    this.token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI2ZDM5NGE5N2VhYTM0ZmJiYWY0MDFiYTMzZjRhZjFiYyIsImlhdCI6MTcwNTA5NDM2MywiZXhwIjoyMDIwNDU0MzYzfQ.91RstDHi9OG1U0_OFWudSjaNGzTo5RWX2laKbhIFZMU';
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
