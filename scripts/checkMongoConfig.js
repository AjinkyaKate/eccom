require('dotenv').config();

const maskMongoUri = (uri = '') => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:<redacted>@');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI is missing from .env');
  process.exit(1);
}

const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@([^/]+)(\/[^?]*)?(\?.*)?$/);

if (!match) {
  console.error('MONGODB_URI format looks invalid.');
  console.error('Expected: mongodb+srv://<user>:<password>@<host>/<db>?retryWrites=true&w=majority');
  process.exit(1);
}

const [, scheme, username, password, host, databasePath, query] = match;

console.log('MongoDB config looks structurally valid.');
console.log(`URI: ${maskMongoUri(uri)}`);
console.log(`Scheme: ${scheme}`);
console.log(`Host: ${host}`);
console.log(`Database: ${databasePath || '<none>'}`);
console.log(`Username length: ${username.length}`);
console.log(`Password length: ${password.length}`);
console.log(`Has query params: ${Boolean(query)}`);
console.log(`Contains mongodb.net host: ${host.includes('.mongodb.net')}`);
