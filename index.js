import HomeAssistant from './helpers/homeassistant.js';
import ws from 'ws';
import http from 'http';
import fs from 'fs';
import { exec } from 'child_process';
import { subscribeEntities } from 'home-assistant-js-websocket';
import { ColorDieb } from './lib/ColorDieb.js';
import { getImageDataFromURL } from './lib/getImageDataFromURL.js';
import { hex2rgb } from './lib/hex2rgb.js';
import { shuffleArray } from './lib/shuffleArray.js';
import { centerImageInSquare } from './lib/centerImageInSquare.js';
import config from './config.js';

global.WebSocket = ws;
const homeassistant = new HomeAssistant();

const coverBase = config.hassioUrl;
const mediaEntities = config.entities;
const imageName = 'cover.jpg';
let cover = '';

var child = null;

function turnOff() {
  setTimeout(() => {
    if (child) child.kill();
    config.wledUrls.forEach((url) => {
      fetch(`${url}/win&T=0`);
    });
  }, 1000);
}

function checkCover(_entities) {
  let url = null;

  mediaEntities.forEach((slug) => {
    const entity = _entities[slug];
    //console.log(entity, 'entitiy')
    if (!entity) return;
    if (entity.state == 'playing' && entity.attributes.entity_picture) {
      url = coverBase + entity.attributes.entity_picture;
    }
  });

  if (!url) {
    cover = null;
    turnOff();
    return;
  }
  if (url == cover) return;

  cover = url;
  // console.log('new cover: ' + url);
  const file = fs.createWriteStream(imageName);
  http
    .get(url, (response) => {
      response.pipe(file);

      file.on('finish', async () => {
        file.close();

        const tempImagePath = imageName;
        const squareImagePath = 'square-' + imageName;

        await centerImageInSquare(
          tempImagePath,
          squareImagePath,
          64,
          config.imageSampling
        );

        const img = config.root + '/rgb-cover/cover.jpg';
        const { imageData, width } = await getImageDataFromURL(img);

        if (config.wledUrls && config.wledUrls.length > 0) {
          const colors = await ColorDieb(imageData, width, config.wledColors);
          const colorsRGB = shuffleArray(colors.map((c) => hex2rgb(c)));
          const col1 = colorsRGB[0];
          const col2 = colorsRGB[1];

          config.wledUrls.forEach((url) => {
            fetch(
              `${url}/win&T=1&R=${col1.r}&G=${col1.g}&B=${col1.b}&R2=${col2.r}&G2=${col2.g}&B2=${col2.b}`
            );
          });
        }

        if (child) {
          child.kill('SIGKILL');
        }
        child = exec(
          `${config.root}/rpi-rgb-led-matrix/utils/led-image-viewer --led-rows=64 --led-cols=64 --led-gpio-mapping=adafruit-hat-pwm --led-brightness=${config.brightness} --led-slowdown-gpio=4 ${config.root}/rgb-cover/square-cover.jpg`,
          { shell: '/bin/bash', detached: true }
        );
        child.on('error', (err) => {
          console.error(err);
          console.error('Failed to start subprocess.');
        });

        child.stderr.on('data', (data) => {
          console.error(`child output: ${data}`);
        });
        child.on('close', (code) => {
          // console.log(`child process exited with code ${code}`);
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
