
// store.js 或在你的 App.js 中
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { taskMiddleware } from 'react-palm/tasks';
import keplerGlReducer from '@kepler.gl/reducers';

// 创建 reducers
const reducers = combineReducers({
  keplerGl: keplerGlReducer
});

// 创建 store
const store = createStore(
  reducers, 
  {}, 
  applyMiddleware(taskMiddleware)
);

export default store;