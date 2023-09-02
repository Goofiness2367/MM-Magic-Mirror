/**
 * Helper class to provide either third party fetch library or (if node >= 18)
 * return internal node fetch implementation.
 *
 * Attention: After some discussion we always return the third party
 * implementation until the node implementation is stable and more tested
 * @see https://github.com/MichMich/MagicMirror/pull/2952
 * @see https://github.com/MichMich/MagicMirror/issues/2649
 * @param {string} url to be fetched
 * @param {object} options object e.g. for headers
 * @class
 */
async function fetch(url, options = {}) {
	// return global.fetch(url, options);

	const nodefetch = require("node-fetch");
	return nodefetch(url, options);
}

module.exports = fetch;
