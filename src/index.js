import async from './async'
import flow from './flow'

export default ({ dispatch, getState }) => next => action => {
  const { payload, meta } = action

  if (meta && !Object.prototype.hasOwnProperty.call(payload, 'ignoreEffect')) {
    if (Object.prototype.hasOwnProperty.call(meta, 'async')) {
      async.handle({ dispatch, getState }, action.type, payload, meta.async)
    }

    if (Object.prototype.hasOwnProperty.call(meta, 'flow')) {
      flow.handle({ dispatch, getState }, action.type, payload, meta.flow)
    }
  }

  next(action)
}
