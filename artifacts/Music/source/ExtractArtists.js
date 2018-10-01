// @license
// Copyright (c) 2018 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt

defineParticle(({DomParticle}) => {
  return class ExtractArtists extends DomParticle {
    async willReceiveProps(props, state, lastProps) {
      if (props.fullPlayHistory
          // Below check is good enough for now.
          && (!lastProps.fullPlayHistory
              || lastProps.fullPlayHistory.length !== props.fullPlayHistory.length)) {
        
        await this.clearHandle('artists');
        const artists = this.handles.get('artists');
        const artistSet = new Set();
        for (const entry of props.fullPlayHistory) {
          if (!artistSet.has(entry.artist)) {
            artistSet.add(entry.artist);
            await artists.store(new artists.entityClass({name: entry.artist}));
          }
        }
      }
    }
  };
});
