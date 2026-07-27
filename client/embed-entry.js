// All the embed needs from the bundle. Not share-entry.js: that one runs
// against the whole document and writes data-theme onto the host page's <html>.
import pies from './pies.js';

window.lpPies = pies;
