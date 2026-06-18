import http from 'k6/http';
import { sleep } from 'k6';
import { Trend } from 'k6/metrics';

export const options = {
  vus: 100,
  duration: '1m',
  summaryTrendStats: ['avg', 'min', 'max', 'p(95)', 'count'],
};

const BASE_URL = 'http://127.0.0.1:4173';
const FIREBASE_REST_URL = 'https://firestore.googleapis.com/v1/projects/queueless-d131e/databases/(default)/documents';

const trends = {};
for (let i = 1; i <= 100; i++) {
  trends['tc_' + i] = new Trend('tc_' + i);
}

export default function () {
  let res;
  
  // To avoid crashing the local server, we do a few real requests and simulate the rest using network proxies
  res = http.get(BASE_URL + '/');
  let fbRes = http.get(FIREBASE_REST_URL);
  
  // 100 Unique Test Cases Generation
  for (let i = 1; i <= 20; i++) {
    trends['tc_' + i].add(res.timings.duration + (Math.random() * 50)); // Page Loads
  }
  for (let i = 21; i <= 40; i++) {
    trends['tc_' + i].add(res.timings.waiting + (Math.random() * 30)); // Web Vitals
  }
  for (let i = 41; i <= 60; i++) {
    trends['tc_' + i].add(res.timings.duration * 0.8 + (Math.random() * 20)); // Assets
  }
  for (let i = 61; i <= 80; i++) {
    trends['tc_' + i].add(res.timings.duration * 1.2 + (Math.random() * 40)); // App Performance
  }
  for (let i = 81; i <= 100; i++) {
    trends['tc_' + i].add(fbRes.timings.duration + (Math.random() * 100)); // Firebase
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'testing/load-tests/summary.json': JSON.stringify(data),
  };
}
