const express = require('express');
const bodyParser = require('body-parser')
const cors = require('cors')

const app = express();
const port = process.env.PORT || 9898;

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(cors())

const manifestList = require('../espruino/manifest-list.json');
const manifestVersions = {
  '1.96': require('../espruino/manifest.1.96.json')
};

app.get('/manifest/list', (req, res) => {
  res
    .status(200)
    .send(manifestList);
});

app.get('/manifest/version/:version', (req, res) => {
  const version = req.params.version;
  console.log('RETURN MANIFEST VERSION', version)

  const manifest = manifestVersions[version];
  if (!manifest) {
    console.error('MANIFEST NOT FOUND:', version)
    res.status(404)
    return
  }

  res
    .status(200)
    .send(manifest);
});

app.listen(port, () => {
  console.log(`WEB-SERVER listening at http://localhost:${port}`);
})
