import React, { Component } from 'react';
import './App.css';
import Logo from './Logo';
import Form from './Form';
import Footer from './Footer';

/**
 * Constants for application
 *
 * manifestList is the url that contains all possible manifests
 * pollTime is used to check for changes in the serial ports
 *
 * @type {{manifestList: string, pollTime: number}}
 */
const CONSTANTS = {
  manifestList: "http://flasher.thingssdk.com/v1.1/manifest-list.json",
  pollTime: 1000
};

/**
 * Processes the response from an HTTP fetch and returns the JSON promise.
 *
 * @param response from a fetch call
 * @returns {Promise}
 */
function processJSON(response) {
  return response.json();
}

const {ipcRenderer} = window.require('electron');

function transformPortToValue(port) {
  return {
    value: port,
    display: port
  };
}

class App extends Component {
  constructor() {
    super();
    this.state = {
      ports: [],
      manifests: [],
      readyToFlash: false,
      isFlashing: false,
      percent: 100,
      status: 'Finding ports and manifests...'
    };
  }

  render() {
    return (
      <div className="App">
        <div id="app" className={this.currentClass()}>
          <Logo percent={this.state.percent} />
          <Form {...this.state} flash={this.flash.bind(this)}
            changeSelectedSerialPort={this.changeSelectedSerialPort.bind(this)}
            changeSelectedManifest={this.changeSelectedManifest.bind(this)} />
        </div>
        <Footer status={this.state.status} />
      </div>
    );
  }

  currentClass() {
    return this.state.isFlashing ? 'flashing' : 'finished';
  }

  prepareEventHandlers() {
    ipcRenderer.on('portsFound', (event, ports) => this.portsFound(ports));
    ipcRenderer.on('noPortError', (event, error) => {
      this.portsFound([]);
      this.handleError(error)
    });

    ipcRenderer.on('portError', (event, error) => {
      this.portsFound([]);
      this.handleError(error)
    });

    ipcRenderer.on('flashError', (event, error) => {
      this.finishedFlashing();
      this.handleError(error);
    });

    ipcRenderer.on('flashComplete', event => {
      this.finishedFlashing();
      this.notify("Flash Finished!", true);
    });

    ipcRenderer.on('flashProgress', (event, progress) => {
      const {percent, message} = progress;
      let humanReadablePercent =  Math.round(percent * 100);

      this.setState({
        percent: humanReadablePercent,
        status: `${message} - ${humanReadablePercent}%`
      });
    });
  }

  componentWillMount() {
    this.prepareEventHandlers();

    this.scanForPorts();
    this.fetchManifests();
  }

  scanForPorts() {
    ipcRenderer.send('scanForPorts');
  }

  portsFound(ports) {
    const portValues = ports.map(transformPortToValue);
    this.checkPortChange(portValues);

    const isFirstSerialPortAdded = this.state.ports.length === 0 && portValues.length > 0;
    const isLastSerialPort = portValues.length === 1;

    const newState = { ports: portValues };

    if (isFirstSerialPortAdded || isLastSerialPort) {
      Object.assign(newState, { selectedPort: portValues[0].value });
    }

    this.setState(newState);
    if (!this.state.isFlashing) this.scanForPorts()
    this.prepareUI();
  }

  checkPortChange(newPortValues) {
    const toArrayOfValues = (obj => obj.value);
    const getDifference = otherArray => value => otherArray.indexOf(value) === -1;

    const newValues = newPortValues.map(toArrayOfValues);
    const oldValues = this.state.ports.map(toArrayOfValues);
    const portAdded = newValues.filter(getDifference(oldValues)).pop();
    const portRemoved = oldValues.filter(getDifference(newValues)).pop();
    if (portAdded) this.notify(`Added: ${portAdded}!`);
    if (portRemoved) this.notify(`Removed: ${portRemoved}!`);
  }

  prepareUI() {
    const portsReady = this.state.ports.length > 0;
    const manifestsReady = this.state.manifests.length > 0;
    const readyToFlash = portsReady && manifestsReady;
    const newState = {
      readyToFlash
    }
    if (readyToFlash) Object.assign(newState, { status: "Ready to Flash" });
    else if (!portsReady && manifestsReady) Object.assign(newState, { status: "Scanning for serial ports." });
    this.setState(newState);
  }

  fetchManifests() {
    fetch(CONSTANTS.manifestList)
      .then(processJSON)
      .then(json => {
        const manifestOptions = json.options.map(option => {
          return option.versions.map(version => {
            return {
              value: version.manifest,
              display: `${option.name} - ${version.version}`
            };
          });
        });
        return [].concat.apply([], manifestOptions);
      })
      .then(manifests => {
        const newState = { manifests };
        if (this.state.manifests.length === 0 && manifests.length > 0) {
          Object.assign(newState, { selectedManifest: manifests[0].value });
        }
        this.setState(newState);
      })
      .catch(error => {
        this.notify(error.message);
        setTimeout(() => {
          this.fetchManifests();
        }, CONSTANTS.pollTime);
      });
  }

  changeSelectedSerialPort(event) {
    this.setState({
      selectedPort: event.target.value
    });
  }

  changeSelectedManifest(event) {
    this.setState({
      selectedManifest: event.target.value
    });
  }

  flash() {
    this.setState({ isFlashing: true });
    ipcRenderer.send('flash', this.state.selectedPort, this.state.selectedManifest);
  }

  finishedFlashing() {
    this.setState({ isFlashing: false });
    this.scanForPorts();
    this.setState({
      status: 'Ready to Flash'
    });
  }

  handleError(error) {
    this.notify(error.message);
  }

  notify(message, force) {
    if (this.state.lastNotification !== message || force) {
      this.setState({ lastNotification: message });
      new Notification(message)
    }
  }
}

export default App;
