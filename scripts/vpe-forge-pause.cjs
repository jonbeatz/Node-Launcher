/** 3s pre-forge pause (replaces `timeout /t 3` — works in non-interactive npm shells on Windows). */
const { setTimeout: delay } = require('timers/promises');
(async () => {
  await delay(3000);
})();
