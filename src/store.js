import { configureStore } from '@reduxjs/toolkit';
import keplerGlReducer from '@kepler.gl/reducers';

const store = configureStore({
  reducer: {
    keplerGl: keplerGlReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          '@@kepler.gl/REGISTER_ENTRY', 
          '@@kepler.gl/REPLACE_DATA_IN_MAP',
          '@@kepler.gl/UPDATE_VIS_DATA',
          '@@kepler.gl/ADD_DATA_TO_MAP'
        ],
      },
    }),
});

export default store;