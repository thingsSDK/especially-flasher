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

function handleError(error) {
  console.log(error.message);
}

class App extends Component {
  constructor() {
    super();
    this.state = {
      ports: [],
      manifests: [],
      readyToFlash: false,
      status: 'Finding ports and manifests...'
    };
  }

  render() {
    return (
      <div className="App">
        <div id="app">
          <Logo />
          <Form {...this.state} flash={this.flash.bind(this)} changeSelectedSerialPort={this.changeSelectedSerialPort.bind(this)} changeSelectedManifest={this.changeSelectedManifest.bind(this)} />
        </div>
        <Footer status={this.state.status} />
      </div>
    );
  }

  componentWillMount() {
    ipcRenderer.on('portsFound', (event, ports) => this.portsFound(ports));
    ipcRenderer.on('noPortError', (event, error) => {
      this.portsFound([]);
      handleError(error)
    });
    ipcRenderer.on('portError', (event, error) => {
      this.portsFound([]);
      handleError(error)
    });

    this.scanForPorts();
    this.fetchManifests();
  }

  scanForPorts() {
    ipcRenderer.send('scanForPorts');
  }

  portsFound(ports) {
    const portValues = ports.map(transformPortToValue);
    const newState = { ports: portValues };
    const isFirstSerialPortAdded = this.state.ports.length === 0 && portValues.length > 0;
    const isLastSerialPort = portValues.length === 1;
    if ( isFirstSerialPortAdded || isLastSerialPort ) {
      Object.assign(newState, { selectedPort: portValues[0].value });
    } 
    this.setState(newState);
    this.scanForPorts()
    this.prepareUI();
  }

  prepareUI() {
    const portsReady = this.state.ports.length > 0;
    const manifestsReady = this.state.manifests.length > 0;
    const readyToFlash = portsReady && manifestsReady;
    const newState = {
      readyToFlash
    }
    if (readyToFlash) Object.assign(newState, { status: "Ready!" });
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
    console.log(this.state.selectedPort);
    console.log(this.state.selectedManifest);
  }
}

export default App;
