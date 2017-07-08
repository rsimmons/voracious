import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';

import MainActions from './mainActions';
import { SubscribableState, StateMapper } from './ruxx';

// Load Kuromoji right away
import { loadKuromoji } from './util/analysis';
loadKuromoji();

// Create state, actions
const subscribableMainState = new SubscribableState();
const actions = new MainActions(subscribableMainState);

ReactDOM.render(<StateMapper subscribableState={subscribableMainState} renderState={state => <App mainState={state} actions={actions} />} />, document.getElementById('root'));
registerServiceWorker();
