'use strict';

let cheerio = require('cheerio');
var Q = require('q');
var rp = require('request-promise');
var winston = require('winston');
var prompt = require('prompt');
var Browser = require("zombie");
var ProgressBar = require('progress');
var colors = require("colors/safe");
prompt.message = '';
var schema = {
  properties: {
    username: {
      required: true,
      description: colors.green.bold("Enter your username")
    },
    password: {
      hidden: true,
      required: true,
      description: colors.green.bold("Enter your password (It will be hidden for security reasons)")
    }
  }
};
var securedWebsite = {
  properties: {
    securedSite: {
      required: true,
      description: colors.green.bold("Enter a page that can be accessed only when logged")
    }
  }
};

Browser.silent = true;
var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      level: 'info',
      colorize: true,
      timestamp: false,
      handleExceptions: false,
      humanReadableUnhandledException: true
    }),
    new (winston.transports.File)({
      level: 'error',
      colorize: false,
      timestamp: false,
      filename: 'Error.log',
      handleExceptions: true,
      humanReadableUnhandledException: true
    })
  ]
});
module.exports = class checkCSRF {
  constructor(url) {
    this._url = url;
    this._url2 = "";
    this._token = "";
    this._token2 = "";
    this._body = "";
    this._body2 = "";
    this._form = "";
    this._form2 = "";
    this._tokenName = "";
    this._formAction = "";
    this._usernameInput = "";
    this._submitButton = "";
    this._passwordInput = "";
    this._responseCode = "";
    this._SUCCESS = 'success';
    this._username = '';
    this._password = '';
    this._COMMON_CSRF_NAMES = [
      'csrf_token',
      'CSRFName',                   // OWASP CSRF_Guard
      'CSRFToken',                  // OWASP CSRF_Guard
      'anticsrf',                   // AntiCsrfParam.java
      '_RequestVerificationToken',  // AntiCsrfParam.java
      'token',
      'csrf',
      'YII_CSRF_TOKEN',             // http://www.yiiframework.com//
      'yii_anticsrf',               // http://www.yiiframework.com//
      '[_token]',                   // Symfony 2.x
      '_csrf_token',                // Symfony 1.4
      'csrfmiddlewaretoken',        // Django 1.5
      'form_key',                   // Magento 1.9
      'authenticity_token'          // Twitter

    ];
    this._entropy = 0;
  }

  getSuccess() {
    return this._SUCCESS;
  }

  checkIfPageHaveAForm() {
    var defer = Q.defer();
    var website = this;
    var found = false;
    let $ = cheerio.load(this._body);
    $('form').each(function (index, element) {
      if ($(this).find('input[type=submit]').length > 0) {
        website._form = $(this).html();
        website._formAction = $(this).attr('action');
        if (($(this).find('input[type=text]').length > 0) && ($('input[type=password]').length > 0) && ($('input[type=submit]').length > 0)) {
          website._usernameInput = $('input[type=text]').attr('name');
          website._passwordInput = $('input[type=password]').attr('name');
          defer.resolve(website._SUCCESS);
          found = true;
        }
      }
    });
    if (found === false) {
      logger.log('error', 'This page doesn\'t contain a form');
      defer.reject(website._ERROR);
    }

    return defer.promise;
  }


  checkIfFormHaveAnHiddenInput() {
    var defer = Q.defer();
    var website = this;
    let $ = cheerio.load(this._form);
    let input = $('input[type="hidden"]');
    if (input.length > 0) {
      console.log('Hidden input found !');
      defer.resolve(website._SUCCESS);
    }
    else {
      let error = 'This page doesn\'t contain a form';
      logger.log('error', error);
      defer.reject(error);
    }
    return defer.promise;
  }

  askSecuredPage() {
    var defer = Q.defer();
    var website = this;
    prompt.get(securedWebsite, function (err, result) {
      website._url2 = result.securedSite;
      defer.resolve(website._SUCCESS);
    });
    return defer.promise;
  }

  formConnect() {
    var defer = Q.defer();
    var website = this;
    prompt.start();
    prompt.get(schema, function (err, result) {
      website._username = result.username;
      website._password = result.password;
      var url = website._url;
      var browser = new Browser();
      var bar = new ProgressBar('PROCESSING [:bar] :percent', { total: 7, width: 100, complete: '█', incomplete: ' ' });
      bar.tick();
      browser.visit(url, function () {
        bar.tick();
        if (browser.success) {
          bar.tick();
          browser
            .fill('input[name="' + website._usernameInput + '"]', website._username);
          bar.tick();
          browser.fill('input[name="' + website._passwordInput + '"]', website._password);
          bar.tick();
          browser.pressButton('input[value="' + website._submitButton + '"]', function (res) {
            bar.tick();
            if (browser.query('input[value=' + website._submitButton + ']') === null) {
              bar.tick();
              console.log('Connection successfully established');
              defer.resolve(website._SUCCESS);
            }
            else {
              bar.tick();
              console.log('\r\n Connection failed, your ID\'s might be invalid');
              defer.reject(website._ERROR);
            }
          });
        }
      });
    });
    return defer.promise;
  }

  checkIfPageIsAvailableWithoutBeingConnected() {
    var defer = Q.defer();
    var website = this;
    var bar = new ProgressBar('PROCESSING [:bar] :percent', { total: 2, width: 100, complete: '█', incomplete: ' ' });
    bar.tick();
    var options = {
      method: 'get',
      uri: website._url2,
      followRedirect: false,
      resolveWithFullResponse: true    //  <---  <---  <---  <---
    };
    var rp = require('request-promise');
    rp(options)
      .then(function (response) {
        bar.tick();
        console.log('Care this page could be accessed without being connected');
        defer.resolve(website._SUCCESS);
      })
      .catch(function (err) {
        if (err.statusCode === 404) {
          bar.tick();
          console.log('The page you requested isn\'t available');
          defer.reject(website._ERROR);
        }
        else {
          bar.tick();
          console.log('The page require to be logged to be accessible');
          defer.resolve(website._SUCCESS);
        }
      });
    return defer.promise;
  }

  checkIfPageIsAvailableWhenConnected() {
    var defer = Q.defer();
    var website = this;
    var url = website._url2;
    var browser = new Browser();
    var bar = new ProgressBar('PROCESSING [:bar] :percent', { total: 7, width: 100, complete: '█', incomplete: ' ' });
    bar.tick();
    browser.visit(url, function () {
      bar.tick();
      if (browser.success) {
        bar.tick();
        browser
          .fill('input[name="' + website._usernameInput + '"]', website._username);
        bar.tick();
        browser.fill('input[name="' + website._passwordInput + '"]', website._password);
        bar.tick();
        browser.pressButton('input[value="' + website._submitButton + '"]', function (res) {
          bar.tick();
          browser.fetch(url)
            .then(function (response) {
              if (response.status === 200) {
                bar.tick();
                console.log('This page is now accessible');
                defer.resolve(website._SUCCESS);
              }
              else {
                bar.tick();
                console.log('\n\rThe required page is not available even when logged');
                defer.reject(website._ERROR);
              }
            });
        });
      }
    });
    return defer.promise;
  }

  checkIfFormContainToken() {
    var defer = Q.defer();
    let $ = cheerio.load(this._form);
    var website = this;
    var found = false;
    $('input[type="hidden"]').each(function (index, element) {
      let input = $(this);
      website._COMMON_CSRF_NAMES.forEach(function (name) {
        if (input.attr('name') == name) {
          website._token = input.prop('value');
          website._tokenName = name;
          console.log('CSRF protection found');
          found = true;
          defer.resolve(website._SUCCESS);
        }
      });
    });

    if (found === false) {
      let error = 'This form doesn\'t have any CSRF protection';
      logger.log('error', error);
      defer.reject(error);
    }
    return defer.promise;
  }

  checkIfTokenChange() {
    var defer = Q.defer();
    var website = this;
    rp(website._url)
      .then(function (body) {
        website._body2 = body;
        let $ = cheerio.load(body);
        let form = $('form');
        if (form.length > 0) {
          website._form2 = form.html();
          let input = $('input[type="hidden"][name=' + website._tokenName + ']');
          if (website._token != input.attr('value') && input.attr('value') !== undefined) {
            console.log('Great, token changes for each session');
            website._token2 = input.attr('value');
            defer.resolve(website._SUCCESS);
          }
          else {
            logger.log('info', 'Token doesn\'t change for each session, this may be a security issue');
            defer.resolve(website._ERROR);
          }
        }
      })
      .catch(function () {
        let error = 'Url is incorrect or site is unreachable for website : ' + website._url;
        logger.log('error', error);
        defer.reject(error);
      });
    return defer.promise;
  }

  checkEntropy() {
    let defer = Q.defer();
    var website = this;
    let entropyFirstToken = 0;
    let entropySecondToken = 0;
    for (let x = 0; x < 256; x++) {
      let char = String.fromCharCode(x);
      let count = website._token.split(char).length - 1;
      let p_x = parseFloat(count) / website._token.length;
      if (p_x > 0) {
        entropyFirstToken += - p_x * Math.log2(p_x);
      }
    }
    for (let x = 0; x < 256; x++) {
      let char = String.fromCharCode(x);
      let count = website._token2.split(char).length - 1;
      let p_x = parseFloat(count) / website._token.length;
      if (p_x > 0) {
        entropySecondToken += - p_x * Math.log2(p_x);
      }
    }
    if (entropyFirstToken > 2.4 && entropySecondToken > 2.4) {
      console.log('CSRF tokens are secured');
      defer.resolve(website._SUCCESS);
    }
    else if (entropyFirstToken > 2.4 || entropySecondToken > 2.4) {
      console.log('One of the CSRF tokens was secured but others weren\'t necessarily, this can be a security breach, consider to change that');
      defer.resolve(website._SUCCESS);
    }
    else {
      let error = 'CSRF tokens aren\'t secured consider changing them to secured ones';
      logger.log('error', error);
      defer.reject(error);
    }
    return defer.promise;
  }

  checkIfFormIsAConnectionForm() {
    var defer = Q.defer();
    var website = this;
    let $ = cheerio.load(this._form);
    if (($('input[type=text]').length > 0) && ($('input[type=password]').length > 0) && ($('input[type=submit]').length > 0)) {
      website._usernameInput = $('input[type=text]').attr('name');
      website._passwordInput = $('input[type=password]').attr('name');
      website._submitButton = $('input[type=submit]').attr('value');
      console.log('This form is a connection form');
      defer.resolve(website._SUCCESS);
    }
    else {
      logger.log('error', 'This form isn\'t a connection form');
      defer.reject(website._ERROR);
    }

    return defer.promise;
  }

  checkAvailability() {
    var defer = Q.defer();
    var website = this;
    rp(website._url)
      .then(function (body) {
        website._responseCode = 200;
        website._body = body;
        defer.resolve(website._SUCCESS);
      })
      .catch(function () {
        let error = 'Url is incorrect or site is unreachable for website : ' + website._url;
        logger.log('error', error);
        defer.reject(error);
      });
    return defer.promise;
  }
};
