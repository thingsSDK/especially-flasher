import React, { Component } from 'react';
import './App.css';
import Logo from './Logo.js';
import Form from './Form.js';
import Footer from './Footer.js';
class App extends Component {
  render() {
    return (
      <div className="App">
        <div id="app">
          <Logo />
          <Form />
        </div>
        <Footer />
      </div>
    );
  }
}

export default App;
