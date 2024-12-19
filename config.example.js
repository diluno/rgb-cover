export default {
  brightness: 85,
  hassioUrl: 'http://homeassistant.local:8123',
  hassioToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI2ZDM5NGE5N2VhYTM0ZmJiYWY0MDFiYTMzZjRhZjFiYyIsImlhdCI6MTcwNTA5NDM2MywiZXhwIjoyMDIwNDU0MzYzfQ.91RstDHi9OG1U0_OFWudSjaNGzTo5RWX2laKbhIFZMU',
  entities: [
    'media_player.living_room',
    'media_player.bathroom',
    'media_player.bedroom',
    'media_player.kitchen',
    'media_player.denon',
  ],
  root: '/home/sam',
  wledUrls: ['http://192.168.1.214', 'http://192.168.1.13'],
};
