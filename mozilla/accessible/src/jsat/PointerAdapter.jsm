/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global Components, XPCOMUtils, Utils, Logger, GestureSettings,
   GestureTracker */
/* exported PointerRelay, PointerAdapter */

'use strict';

const Ci = Components.interfaces;
const Cu = Components.utils;

this.EXPORTED_SYMBOLS = ['PointerRelay', 'PointerAdapter']; // jshint ignore:line

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

XPCOMUtils.defineLazyModuleGetter(this, 'Utils', // jshint ignore:line
  'resource://gre/modules/accessibility/Utils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Logger', // jshint ignore:line
  'resource://gre/modules/accessibility/Utils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'GestureSettings', // jshint ignore:line
  'resource://gre/modules/accessibility/Gestures.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'GestureTracker', // jshint ignore:line
  'resource://gre/modules/accessibility/Gestures.jsm');

// The virtual touch ID generated by a mouse event.
const MOUSE_ID = 'mouse';
// Synthesized touch ID.
const SYNTH_ID = -1;

let PointerRelay = { // jshint ignore:line
  /**
   * A mapping of events we should be intercepting. Entries with a value of
   * |true| are used for compiling high-level gesture events. Entries with a
   * value of |false| are cancelled and do not propogate to content.
   */
  get _eventsOfInterest() {
    delete this._eventsOfInterest;

    switch (Utils.widgetToolkit) {
      case 'gonk':
        this._eventsOfInterest = {
          'touchstart' : true,
          'touchmove' : true,
          'touchend' : true,
          'mousedown' : false,
          'mousemove' : false,
          'mouseup': false,
          'click': false };
        break;

      case 'android':
        this._eventsOfInterest = {
          'touchstart' : true,
          'touchmove' : true,
          'touchend' : true,
          'mousemove' : true,
          'mouseenter' : true,
          'mouseleave' : true,
          'mousedown' : false,
          'mouseup': false,
          'click': false };
        break;

      default:
        // Desktop.
        this._eventsOfInterest = {
          'mousemove' : true,
          'mousedown' : true,
          'mouseup': true,
          'click': false
        };
        if ('ontouchstart' in Utils.win) {
          for (let eventType of ['touchstart', 'touchmove', 'touchend']) {
            this._eventsOfInterest[eventType] = true;
          }
        }
        break;
    }

    return this._eventsOfInterest;
  },

  _eventMap: {
    'touchstart' : 'pointerdown',
    'mousedown' : 'pointerdown',
    'mouseenter' : 'pointerdown',
    'touchmove' : 'pointermove',
    'mousemove' : 'pointermove',
    'touchend' : 'pointerup',
    'mouseup': 'pointerup',
    'mouseleave': 'pointerup'
  },

  start: function PointerRelay_start(aOnPointerEvent) {
    Logger.debug('PointerRelay.start');
    this.onPointerEvent = aOnPointerEvent;
    for (let eventType in this._eventsOfInterest) {
      Utils.win.addEventListener(eventType, this, true, true);
    }
  },

  stop: function PointerRelay_stop() {
    Logger.debug('PointerRelay.stop');
    delete this.lastPointerMove;
    delete this.onPointerEvent;
    for (let eventType in this._eventsOfInterest) {
      Utils.win.removeEventListener(eventType, this, true, true);
    }
  },

  _suppressPointerMove: function PointerRelay__suppressPointerMove(aChangedTouches) {
    if (!this.lastPointerMove) {
      return false;
    }
    for (let i = 0; i < aChangedTouches.length; ++i) {
      let touch = aChangedTouches[i];
      let lastTouch;
      try {
        lastTouch = this.lastPointerMove.identifiedTouch ?
          this.lastPointerMove.identifiedTouch(touch.identifier) :
          this.lastPointerMove[i];
      } catch (x) {
        // Sometimes touch object can't be accessed after page navigation.
      }
      if (!lastTouch || lastTouch.target !== touch.target ||
        Math.hypot(touch.screenX - lastTouch.screenX, touch.screenY -
          lastTouch.screenY) / Utils.dpi >= GestureSettings.travelThreshold) {
        return false;
      }
    }
    return true;
  },

  handleEvent: function PointerRelay_handleEvent(aEvent) {
    // Don't bother with chrome mouse events.
    if (Utils.MozBuildApp === 'browser' &&
      aEvent.view.top instanceof Ci.nsIDOMChromeWindow) {
      return;
    }
    if (aEvent.mozInputSource === Ci.nsIDOMMouseEvent.MOZ_SOURCE_UNKNOWN) {
      // Ignore events that are scripted or clicks from the a11y API.
      return;
    }

    let changedTouches = aEvent.changedTouches || [{
      identifier: MOUSE_ID,
      screenX: aEvent.screenX,
      screenY: aEvent.screenY,
      target: aEvent.target
    }];

    if (changedTouches.length === 1 &&
        changedTouches[0].identifier === SYNTH_ID) {
      return;
    }

    aEvent.preventDefault();
    aEvent.stopImmediatePropagation();

    let type = aEvent.type;
    if (!this._eventsOfInterest[type]) {
      return;
    }
    let pointerType = this._eventMap[type];
    if (pointerType === 'pointermove') {
      if (this._suppressPointerMove(changedTouches)) {
        // Do not fire pointermove more than every POINTERMOVE_THROTTLE.
        return;
      }
      this.lastPointerMove = changedTouches;
    }
    this.onPointerEvent({
      type: pointerType,
      points: Array.prototype.map.call(changedTouches,
        function mapTouch(aTouch) {
          return {
            identifier: aTouch.identifier,
            x: aTouch.screenX,
            y: aTouch.screenY
          };
        }
      )
    });
  }
};

this.PointerAdapter = { // jshint ignore:line
  start: function PointerAdapter_start() {
    Logger.debug('PointerAdapter.start');
    GestureTracker.reset();
    PointerRelay.start(this.handleEvent);
  },

  stop: function PointerAdapter_stop() {
    Logger.debug('PointerAdapter.stop');
    PointerRelay.stop();
    GestureTracker.reset();
  },

  handleEvent: function PointerAdapter_handleEvent(aDetail) {
    let timeStamp = Date.now();
    GestureTracker.handle(aDetail, timeStamp);
  }
};