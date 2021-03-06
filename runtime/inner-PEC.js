/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
"use strict";

const Scope = require('./scope.js');
const testEntities = require('./test/test-entities.js');
const loader = require('./loader.js');
const Type = require('./type.js');
const viewlet = require('./viewlet.js');
const define = require('./particle.js').define;
const assert = require('assert');
const typeLiteral = require('./type-literal.js');

class RemoteView {
  constructor(id, connectionName, port, pec) {
    this._id = id;
    this._connectionName = connectionName;
    this._port = port;
    this._pec = pec;
    this._scope = pec._scope;
  }

  on(type, callback, target) {
    var cid = this._pec._newLocalID();
    this._pec._establishThingMapping(cid, callback)
    this._port.postMessage({
      messageType: "ViewOn",
      messageBody: {
        view: this._id,
        type: type,
        callback: cid,
        target: this._pec._identifierForThing(target)
      }
    });
  }

  get() {
    return this._pec.postPromise("ViewGet", {view: this._id});
  }

  toList() {
    return this._pec.postPromise("ViewToList", {view: this._id});
  }

  set(entity) {
    this.postSend(entity, "ViewSet");
  }

  store(entity) {
    this.postSend(entity, "ViewStore");
  }

  postSend(entity, messageType) {
    this._port.postMessage({
      messageType,
      messageBody: {
        view: this._id,
        data: entity
      }
    });
  }

  get connectionName() {
    return this._connectionName;
  }
}

class InnerPEC {
  constructor(port) {
    this._port = port;
    this._port.onmessage = e => this._handle(e);
    this._scope = new Scope();
    // TODO: really should have a nicer approach for loading
    // default particles & types.
    testEntities.register(this._scope);
    this._views = new Map();
    this._reverseIdMap = new Map();
    this._idMap = new Map();
    this._nextLocalID = 0;
    this._particles = [];
  }

  _newLocalID() {
    return "l" + this._nextLocalID++;
  }

  _establishThingMapping(id, thing) {
    this._reverseIdMap.set(thing, id);
    this._idMap.set(id, thing);
  }

  _identifierForThing(thing) {
    return this._reverseIdMap.get(thing);
  }

  _thingForIdentifier(id) {
    return this._idMap.get(id);
  }

  _handle(e) {
    switch (e.data.messageType) {
      case "InstantiateParticle":
        this._instantiateParticle(e.data.messageBody);
        return;
      case "DefineParticle":
        this._defineParticle(e.data.messageBody);
        return;
      case "ViewCallback":
        this._viewCallback(e.data.messageBody);
        return;
      case "ViewGetResponse":
      case "ViewToListResponse":
      case "HaveASlot":
        this._promiseResponse(e.data.messageBody);
        return;
      case "LostSlots":
        this._lostSlots(e.data.messageBody);
        return;
      case "AwaitIdle":
        this._awaitIdle(e.data.messageBody);
        return;
      default:
        assert(false, "Don't know how to handle messages of type " + e.data.messageType);
    }
  }

  _viewCallback(data) {
    var callback = this._thingForIdentifier(data.callback);
    callback(data.data);
  }

  postPromise(messageType, messageBody) {
    var rid = this._newLocalID();
    var result = new Promise((resolve, reject) => this._establishThingMapping(rid, (d) => resolve(d)));
    messageBody.callback = rid;

    this._port.postMessage({ messageType, messageBody });
    return result;
  }

  _promiseResponse(data) {
    var resolve = this._thingForIdentifier(data.callback);
    resolve(data.data);
  }

  _defineParticle(data) {
    var particle = define(data.particleDefinition, eval(data.particleFunction));
    this._scope.registerParticle(particle);
  }

  constructParticle(clazz) {
    return new clazz(this._scope);
  }

  _remoteViewFor(id, isView, connectionName) {
    var v = this._thingForIdentifier(id);
    if (v == undefined) {
      v = new RemoteView(id, connectionName, this._port, this);
      this._establishThingMapping(id, v);
    }
    return viewlet.viewletFor(v, isView);
 }

  _instantiateParticle(data) {
    if (!this._scope.particleRegistered(data.particleName)) {
      var clazz = loader.loadParticle(data.particleName);
      this._scope.registerParticle(clazz);
    }


    for (let type of data.types) {
      /*
       * This section ensures that the relevant types are known
       * in the scope object, because otherwise we can't do
       * particleSpec resolution, which is currently a necessary
       * part of particle construction.
       *
       * Possibly we should eventually consider having particle
       * specifications separated from particle classes - and
       * only keeping type information on the arc side.
       */
      if (typeLiteral.isView(type)) {
        type = typeLiteral.primitiveType(type);
      }
      // TODO: This is a dodgy hack based on possibly unintended
      // behavior in Type's constructor.
      if (!this._scope._types.has(JSON.stringify(type))) {
        this._scope.typeFor(loader.loadEntity(type));
      }
    }

    var particle = this._scope.instantiateParticle(data.particleName, this);
    this._establishThingMapping(data.particleIdentifier, particle);
    this._particles.push(particle);

    var viewMap = new Map();

    for (let connectionName in data.views) {
      let {viewIdentifier, viewType} = data.views[connectionName];
      let type = Type.fromLiteral(viewType, this._scope);
      var view = this._remoteViewFor(viewIdentifier, type.isView, connectionName);
      viewMap.set(connectionName, view);
    }

    particle.setSlotCallback(async (name, state) => {
      switch (state) {
        case "Need":
          var data = await this.postPromise("GetSlot", {name, particle: this._identifierForThing(particle)})
          var slot = {
            render: (content) => {
              this._port.postMessage({
                messageType: 'RenderSlot',
                messageBody: {
                  content,
                  particle: this._identifierForThing(particle),
                }
              });
            }
          };
          particle.setSlot(slot);
          break;
        
        case "No":
          this._port.postMessage({ messageType: "ReleaseSlot", messageBody: {particle: this._identifierForThing(particle)}});
          break;
      }
    });

    particle.setViews(viewMap);
  }

  _lostSlots(particleIds) {
    // clean up slots that disappeared
    particleIds.forEach(pid => {
      let particle = this._thingForIdentifier(pid);
      particle.slotReleased();
    });
  }

  get relevance() {
    var rMap = {};
    this._particles.forEach(p => {
      if (p.relevances.length == 0)
        return;
      rMap[this._identifierForThing(p)] = p.relevances;
      p.relevances = [];
    });
    return rMap;
  }

  get busy() {
    for (let particle of this._particles) {
      if (particle.busy) {
        return true;
      }
    }
    return false;
  }

  _awaitIdle(message) {
    this.idle.then(() => {
      this._port.postMessage({
        messageType: "Idle",
        messageBody: {version: message.version, relevance: this.relevance }
      });
    });
  } 

  get idle() {
    if (!this.busy) {
      return Promise.resolve();
    }
    return Promise.all(this._particles.map(particle => particle.idle)).then(() => this.idle);
  }
}

module.exports = InnerPEC;
