import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { taskMiddleware } from 'react-palm/tasks';
import keplerGlReducer from '@kepler.gl/reducers';
import LogisticsMap from './LogisticsMap';

// 创建 Redux store
const reducers = combineReducers({
  keplerGl: keplerGlReducer
});

const store = createStore(
  reducers, 
  {}, 
  applyMiddleware(taskMiddleware)
);

// 渲染应用
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <LogisticsMap />
  </Provider>
);