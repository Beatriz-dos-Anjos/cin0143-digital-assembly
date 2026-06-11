// k6 run tests/load/voting-stress.js
import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '60s',
};

export default function () {
  // lógica de stress test aqui
}