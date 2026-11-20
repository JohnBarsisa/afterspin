// GitHub Pages and the hosted app use the same deployed token issuer.
// The standalone offline build replaces this configuration with an empty one.
const afterspinAppleServer = 'https://afterspin-listening.jpiyady.chatgpt.site';
window.AFTERSPIN_CONFIG = Object.freeze({
  appleTokenEndpoint: afterspinAppleServer + '/api/apple-token',
  appleStatusEndpoint: afterspinAppleServer + '/api/apple/status',
});
