import React from 'react'
import { render } from 'react-dom'
import { createStore, applyMiddleware } from 'redux'
import { Provider } from 'react-redux'
import ReduxThunk from 'redux-thunk'
import createReduxLogger from 'redux-logger'

import rootReducer from './reducers'
import RootComponent from './components'

const middlewares = [ReduxThunk];

if (process.env.NODE_ENV === 'development') {
  middlewares.push(createReduxLogger());
}

const store = createStore(rootReducer, applyMiddleware(...middlewares));

render(
  <Provider store={store}>
    <RootComponent />
  </Provider>,
  document.getElementById('root')
);
