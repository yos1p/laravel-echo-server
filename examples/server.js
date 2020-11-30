var echo = require('../dist/index.js');

var options = {
  host: 'localhost',
  port: 8080
};

const start = async function () {
    await echo.run(options)
}
start()
