/**
 * store.js — Lightweight reactive state store (pub/sub)
 *
 * Usage:
 *   import store from './store/store.js';
 *   store.subscribe('routines', handler);
 *   store.set('routines', [...]);
 *   store.get('routines');
 */

const _state = {};
const _listeners = {};

function subscribe(key, handler) {
  if (!_listeners[key]) _listeners[key] = [];
  _listeners[key].push(handler);
  // Return unsubscribe function
  return () => {
    _listeners[key] = _listeners[key].filter(h => h !== handler);
  };
}

function set(key, value) {
  _state[key] = value;
  (_listeners[key] || []).forEach(h => h(value));
}

function get(key) {
  return _state[key];
}

function update(key, updater) {
  set(key, updater(_state[key]));
}

export const store = { subscribe, set, get, update };
export default store;
