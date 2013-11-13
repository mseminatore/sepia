var url = require('url');
var path = require('path');
var crypto = require('crypto');
var fs = require('fs');

var filenamePrefix = path.join(process.cwd(), 'fixtures/generated');

var filenameFilters = [];

var alwaysRecordOverrideUrls = [];

//include headers names in the hash
var includeHeaderNames = true;
var headerWhitelist = [];

//include cookies names in the hash
var includeCookieNames = true;
var cookieWhitelist = [];

//give verbose output for hits and misses in log.
var verbose = false;

//Touch the cached file every time its used.
var touchHits = true;

var testOptions = {};

function configure(options) {
  if (options.includeHeaderNames != null) {
    includeHeaderNames = options.includeHeaderNames;
  }
  if (options.headerWhitelist != null) {
    headerWhitelist = options.headerWhitelist.map(function(item) {
      return item.toLowerCase();
    });
  }
  if (options.includeCookieNames != null) {
    includeCookieNames = options.includeCookieNames;
  }
  if (options.cookieWhitelist != null) {
    cookieWhitelist = options.cookieWhitelist.map(function(item) {
      return item.toLowerCase();
    });
  }
  if (options.verbose != null) {
    verbose = options.verbose;
  }
  if (options.touchHits != null) {
    touchHits = options.touchHits;
  }
}


function setFixtureDir(fixtureDir) {
  filenamePrefix = fixtureDir;
}

function mkdirpSync(folder) {
  if (!fs.existsSync(path.dirname(folder))) {
    mkdirpSync(path.dirname(folder));
  }

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, '0755');
  }
}

function filterByWhitelist(list, whitelist) {
  if (whitelist.length === 0) {
    return list;
  }

  return list.filter(function(item) {
    return whitelist.indexOf(item) >= 0;
  });
}

function parseCookiesNames(cookieValue) {
  var cookies = [];

  if (!cookieValue || cookieValue === '') {
    return cookies;
  }

  var ary = cookieValue.toString().split(/;\s+/);
  ary.forEach(function(ck) {
    var ck = ck.trim();
    if (ck !== '') {
      var parsed = ck.split('=')[0];
      if (parsed && parsed !== '') {
        cookies.push(parsed.toLowerCase().trim());
      }
    }
  });

  cookies = filterByWhitelist(cookies, cookieWhitelist);
  return cookies.sort();
}

function parseHeaderNames(headers) {
  var headerNames = [];
  for (var name in headers) {
    if (headers.hasOwnProperty(name)) {
      headerNames.push(name.toLowerCase());
    }
  }

  headerNames = filterByWhitelist(headerNames, headerWhitelist);
  return headerNames.sort();
}

function setTestOptions(options) {
  testOptions = {};
  testOptions.testName = options.testName;
}

function constructFilename(method, reqUrl, reqBody, reqHeaders) {
  method = method || 'GET';

  filenameFilters.forEach(function(filter) {
    if (filter.url.test(reqUrl)) {
      reqUrl = filter.urlFilter(reqUrl);
      reqBody = filter.bodyFilter(reqBody);
    }
  });

  var hash = crypto.createHash('md5');
  var hashBody = {
    method: method,
    url: reqUrl,
    body: reqBody
  };

  reqHeaders = reqHeaders || {};

  if (includeCookieNames) {
    hashBody.cookies = parseCookiesNames(reqHeaders.cookie);
  }

  if (includeHeaderNames) {
    hashBody.headers = parseHeaderNames(reqHeaders);
  }

  hash.update(JSON.stringify(hashBody));

  var filename = hash.digest('hex');

  var language = reqHeaders && reqHeaders['accept-language'] || '';
  language = language.split(',')[0];

  // use a different folder for each language
  var testFolder = testOptions.testName || '';
  var folder = path.resolve(filenamePrefix, language, testFolder);
  mkdirpSync(folder);

  var hashFile = path.join(folder, filename).toString();

  var exists = (verbose || touchHits) && fs.existsSync(hashFile + '.headers');

  if (verbose) {
    if (exists) {
      logSuccess('====Cache Hit=====================================\n',
                  hashBody,
                  '\n=========================================\n',
                  'File: ', hashFile + '.headers',
                  '\n=========================================\n');
    } else {
      logError('====Cache Miss=====================================\n',
                  hashBody,
                  '\n=========================================\n',
                  'File: ', hashFile + '.headers',
                  '\n=========================================\n');
    }
  }

  //start a process to touch the hash file to notify watchers that it changed.
  if (touchHits && exists){
    fs.utimesSync(hashFile + '.headers', new Date(), new Date())
  }


  return hashFile;
}

function urlFromHttpRequestOptions(options, protocol) {
  var urlOptions = {
    protocol: protocol,
    hostname: options.hostname || options.host,
    auth: options.auth,
    port: options.port,
    pathname: options.path
  };

  return url.format(urlOptions);
}

function addFilter(inFilter) {
  // Get rid of extraneous properties, and put in defaults.
  var filter = {};
  filter.url = inFilter.url || /.*/;
  filter.urlFilter = inFilter.urlFilter || function(url) { return url; };
  filter.bodyFilter = inFilter.bodyFilter || function(body) { return body; };

  filenameFilters.push(filter);
}



function log(color, args) {
  if (!verbose) {
    return;
  }

  var reset = '\033[0m';

  var args = Array.prototype.slice.call(args);
  args.unshift(color);

  args.push(reset);

  console.log.apply(console, args);

}
function logError() {
  log('\033[31m', arguments);
}
function logSuccess() {
  log('\033[32m', arguments);
}

function shouldForceLive(reqUrl) {
  return alwaysRecordOverrideUrls.some(function(url) {
    return reqUrl.indexOf(url) >= 0;
  });
}

function addAlwaysRecordOverride(url) {
  alwaysRecordOverrideUrls.push(url);
}

module.exports.setFixtureDir = setFixtureDir;
module.exports.constructFilename = constructFilename;
module.exports.urlFromHttpRequestOptions = urlFromHttpRequestOptions;
module.exports.addFilter = addFilter;
module.exports.addAlwaysRecordOverride = addAlwaysRecordOverride;
module.exports.configure = configure;
module.exports.logSuccess = logSuccess;
module.exports.logError = logError;
module.exports.shouldForceLive = shouldForceLive;
module.exports.setTestOptions = setTestOptions;

module.exports.internal = {};
module.exports.internal.filterByWhitelist = filterByWhitelist;
