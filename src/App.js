// App.js
import React from 'react';
import { Provider } from 'react-redux';
import store from './store'; // 导入上面的 store
import LogisticsMap from './LogisticsMap';

function App() {
  return (
    <Provider store={store}>
      <LogisticsMap />
    </Provider>
  );
}

export default App;