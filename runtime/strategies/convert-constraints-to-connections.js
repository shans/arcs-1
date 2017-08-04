// Copyright (c) 2017 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt

let {Strategy} = require('../../strategizer/strategizer.js');
let Recipe = require('../recipe/recipe.js');
let RecipeWalker = require('../recipe/walker.js');
let RecipeUtil = require('../recipe/recipe-util.js');

class ConvertConstraintsToConnections extends Strategy {
  async generate(strategizer) {
    var results = Recipe.over(strategizer.generated, new class extends RecipeWalker {
      onRecipe(recipe) {
        var particles = new Set();
        var views = new Set();
        var map = {};
        var viewCount = 0;
        for (var constraint of recipe.connectionConstraints) {
          particles.add(constraint.fromParticle);
          if (map[constraint.fromParticle] == undefined)
            map[constraint.fromParticle] = {};
          particles.add(constraint.toParticle);
          if (map[constraint.toParticle] == undefined)
            map[constraint.toParticle] = {};
          var view = map[constraint.fromParticle][constraint.fromConnection];
          if (view == undefined) {
            view = 'v' + viewCount++;
            map[constraint.fromParticle][constraint.fromConnection] = view;
            views.add(view);
          }
          map[constraint.toParticle][constraint.toConnection] = view;
        }
        var shape = RecipeUtil.makeShape([...particles.values()], [...views.values()], map);
        var results = RecipeUtil.find(recipe, shape);

        return results.map(match => {
          return (recipe) => {
            var score = recipe.connectionConstraints.length + match.score;
            var recipeMap = recipe.updateToClone(match.match);
            for (var particle in map) {
              for (var connection in map[particle]) {
                var view = map[particle][connection];
                var recipeParticle = recipeMap[particle];
                if (recipeParticle == null) {
                  recipeParticle = recipe.newParticle(particle);
                  recipeMap[particle] = recipeParticle;
                }
                var recipeViewConnection = recipeParticle.connections[connection];
                if (recipeViewConnection == undefined)
                  recipeViewConnection = recipeParticle.addConnectionName(connection);
                var recipeView = recipeMap[view];
                if (recipeView == null) {
                  recipeView = recipe.newView();
                  recipeMap[view] = recipeView;
                }
                if (recipeViewConnection.view == null)
                  recipeViewConnection.connectToView(recipeView);
              }
            }
            recipe.clearConnectionConstraints();
            return score;
          }
        });
      }
    }(RecipeWalker.Independent), this);

    return { results, generate: null };
  }
}

module.exports = ConvertConstraintsToConnections;