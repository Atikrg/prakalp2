function decryptToken(token) {
    const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
    const userData = JSON.parse(decodedToken)[0];
    return userData;
  }
  
  module.exports = decryptToken;
  