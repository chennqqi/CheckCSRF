#!/usr/bin/env node

'use strict';

var program = require('commander');
var csrf = require('./checkCSRF.js');
var website = null;
program
  .version('1.0.0')
  .option('-u, --url [url]', 'Url of the website')
  .parse(process.argv);
if (program.url && program.url !== '') {
  website = new csrf(program.url);
  return website.checkAvailability().then(function () {
    return website.checkIfPageHaveAForm().then(function () {
      return website.checkIfFormIsAConnectionForm().then(function () {
        return website.formConnect().then(function () {
          return website.askSecuredPage().then(function () {
            return website.checkIfPageIsAvailableWithoutBeingConnected().then(function () {
              return website.checkIfPageIsAvailableWhenConnected().then(function () {
                return website.checkIfFormHaveAnHiddenInput().then(function () {
                  return website.checkIfFormContainToken().then(function () {
                    return website.checkIfTokenChange().then(function () {
                      return website.checkEntropy().then(function () {
                        process.exit(0);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
} else { // if URL is empty :
  console.log('Please provide an URL to continue');
}
