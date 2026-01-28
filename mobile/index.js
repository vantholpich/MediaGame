import { registerRootComponent } from 'expo';
import { vexo } from 'vexo-analytics';

vexo('dc5675d7-8f63-4d39-bece-09667e563bb8');

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
