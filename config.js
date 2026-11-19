// Optional public endpoint. Return {"developerToken":"<short-lived Apple developer JWT>"}.
// Never commit a MusicKit .p8 key or other signing credentials.
window.AFTERSPIN_CONFIG = Object.freeze({ appleTokenEndpoint: '' });
