import React from 'react';
import { Provider } from 'react-redux';
import store from './store';
import LogisticsMap from './LogisticsMap';
import './App.css';

function App() {
  return (
    <Provider store={store}>
      <div className="App">
        <LogisticsMap />
      </div>
    </Provider>
  );
}

export default App;