export default {
  // Matrix brightness (0-100)
  brightness: 85,
  
  // Home Assistant connection
  hassioUrl: 'http://homeassistant.local:8123',
  hassioToken: 'your-long-lived-access-token-here',
  
  // Media players to monitor (in priority order - first playing wins)
  entities: [
    'media_player.living_room',
    'media_player.bathroom',
    'media_player.bedroom',
    'media_player.kitchen',
    'media_player.denon',
  ],
  
  // WLED ambient lighting
  wledColors: 5,
  wledUrls: ['http://192.168.1.214', 'http://192.168.1.13'],
  
  // Transition settings
  // Options: 'crossfade', 'slideLeft', 'slideRight', 'slideUp', 'slideDown', 'dissolve'
  transition: 'crossfade',
  transitionDuration: 500, // milliseconds
  
  // Web interface port
  webPort: 3000,
  
  // Clock settings (shown when nothing is playing)
  showClock: true,
  clockColor: { r: 120, g: 80, b: 200 }, // Purple
  
  // CO2 monitoring - shows red dot when above threshold
  co2Entity: 'sensor.indoor_carbon_dioxide',
  co2Threshold: 1000, // ppm
};
