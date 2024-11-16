import HomeAssistant from './helpers/homeassistant.js';
import ws from 'ws';
import http from 'http';
import fs from 'fs';
import { exec } from 'child_process';
import { subscribeEntities } from 'home-assistant-js-websocket';
import ColorThief from 'colorthief';

global.WebSocket = ws;
const homeassistant = new HomeAssistant();

console.log('welcome');

const coverBase = 'http://homeassistant.local:8123';
const mediaEntities = [
  'media_player.living_room',
  'media_player.bathroom',
  'media_player.bedroom',
  'media_player.kitchen',
];
const imageName = 'cover.jpg';
let cover = '';

var child = null;

function turnOff() {
  setTimeout(() => {
    if (child) child.kill();
  }, 2000);
}

function checkCover(_entities) {
  let url = null;
  mediaEntities.forEach((slug) => {
    const entity = _entities[slug];
    if (!entity) return;
    if (entity.state == 'playing' && entity.attributes.entity_picture) {
      url = coverBase + entity.attributes.entity_picture;
    }
  });
  if (!url) {
    turnOff();
    return;
  }
  if (url == cover) return;
  console.log(url);
  cover = url;
  console.log('new cover: ' + url);
  const file = fs.createWriteStream(imageName);
  http
    .get(url, (response) => {
      response.pipe(file);

      file.on('finish', () => {
        file.close();

        const img = '/home/sam/rgb-cover/cover.jpg';

        ColorThief.getPalette(img, 2)
          .then((palette) => {
            const palettePadded = palette.map((col) => {
              return col.map((val) => {
                return val.toString().padStart(3, '0');
              });
            });
            const col1 = palettePadded[0].join('');
            const col2 = palettePadded[1].join('');
            console.log(col1, col2);
            fetch(`http://192.168.1.214/win&CL=${col1}&C2=${col2}`);
          })
          .catch((err) => {
            console.log(err);
          });

        if (child) {
          child.kill('SIGKILL');
        }
        child = exec(
          '/home/sam/rpi-rgb-led-matrix/utils/led-image-viewer --led-rows=64 --led-cols=64 --led-gpio-mapping=adafruit-hat-pwm --led-brightness=90 --led-slowdown-gpio=4 /home/sam/rgb-cover/cover.jpg',
          { shell: '/bin/bash', detached: true }
        );
        child.on('error', (err) => {
          console.error(err);
          console.error('Failed to start subprocess.');
        });

        child.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
        });
        child.on('close', (code) => {
          console.log(`child process exited with code ${code}`);
        });
      });
    })
    .on('error', (err) => {
      fs.unlink(imageName);
      console.error(`Error downloading image: ${err.message}`);
    });
}

const conn = await homeassistant.connectSocket();
subscribeEntities(conn, (ent) => {
  checkCover(ent);
});
