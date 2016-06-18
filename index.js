import React from 'react';
import { render } from 'react-dom';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import ReduxThunk from 'redux-thunk';
import createReduxLogger from 'redux-logger';
import { Iterable } from 'immutable';

import rootReducer from './reducers';
import RootComponent from './components';

// Load Kuromoji right away
import { loadKuromoji } from './util/analysis';
loadKuromoji();

const middlewares = [ReduxThunk];

if (process.env.NODE_ENV === 'development') {
  // Since our state is an Immutable object, need to transform it for logging
  const stateTransformer = (state) => {
    if (Iterable.isIterable(state)) {
      return state.toJS();
    }
    return state;
  };

  // middlewares.push(createReduxLogger({ stateTransformer }));
}

const store = createStore(rootReducer, applyMiddleware(...middlewares));

render(
  <Provider store={store}>
    <RootComponent />
  </Provider>,
  document.getElementById('root')
);
