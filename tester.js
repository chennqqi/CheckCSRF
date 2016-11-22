#!/usr/bin/env node

'use strict';

var program = require('commander');
var csrf = require('./checkCSRF.js');
var website = null;
program
  .version('1.0.0')
  .option('-u, --url [url]', 'Url of the website')
  .parse(process.argv);
if (program.url) {
  if (program.url !== "") { // on vérifie si l'url du fichier a caster n'est pas vide
    website = new csrf(program.url);
    return website.checkAvailability()
      .then(function () {
        return website.checkIfPageHaveAForm().then(function(){
          return website.checkIfFormHaveAnHiddenInput().then(function(){
            return website.checkIfFormContainToken().then(function(){
              return website.checkIfTokenChange().then(function(){
                  return website.checkEntropy();
              });
            });
          });
        });
      });
  } else { // si l'url du fichier à caster est vide :
    console.log('Url is incorrect');
  }
} else { // si l'utilisateur n'a pas mis l'argument -f :
  console.log('Please provide an url to continue');
}
