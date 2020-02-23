import async from '../src/async'
import flow, { Flow } from '../src/flow'

describe('flow', () => {
  let action, fetchAsyncObj, queryAsyncObj, flowObj, props, store
  const payload = { foo: 'bar' }

  beforeEach(() => {
    resetFlowState()

    queryAsyncObj = payload => ({
      type: 'user/queryUsers',
      payload,
      meta: {
        async: {
          effect: jest.fn(),
          resolve: { type: 'user/resolveQueryUsers' },
          reject: { type: 'user/rejectQueryUsers' }
        }
      }
    })

    fetchAsyncObj = payload => ({
      type: 'user/fetchUsers',
      payload,
      meta: {
        async: {
          effect: jest.fn(),
          resolve: { type: 'user/resolveFetchUsers' },
          reject: { type: 'user/rejectFetchUsers' }
        }
      }
    })

    flowObj = payload => ({
      type: 'user/getUsers',
      payload,
      meta: {
        flow: {
          actions: [
            {
              effect: fetchAsyncObj
            }
          ],
          resolve: { type: 'user/resolveGetUsers' },
          reject: { type: 'user/rejectGetUsers' }
        }
      }
    })

    action = flowObj({ foo: 'bar' })
    store = {
      dispatch: jest.fn(),
      getState: jest.fn()
    }

    props = {
      store,
      type: action.type,
      payload,
      flowAction: action.meta.flow.actions[0],
      prevResponse: []
    }
  })

  describe('_addToQueue', () => {
    it('must add task to queue', () => {
      const { type, payload } = action

      expect(flow.flowQueue).toEqual([])

      flow._addToQueue(type, payload, action.meta.flow)

      expect(flow.flowQueue).toEqual([
        { type, payload, meta: { flow: action.meta.flow } }
      ])
    })
  })

  describe('_attachParamsToPayload', () => {
    it('must attach params to payload', () => {
      const payload = action.payload
      const actionWithPrepare = {
        ...action.meta.flow.actions[0],
        prepare: () => 'params'
      }

      const newPayload = flow._attachParamsToPayload(
        store,
        payload,
        actionWithPrepare,
        []
      )

      expect(newPayload).toMatchObject({
        ...payload,
        params: 'params'
      })
    })
  })

  describe('_responseIsNotValid', () => {
    it('must return true if break property is provided and the result is true', () => {
      const payload = action.payload
      const actionWithBreak = {
        ...action.meta.flow.actions[0],
        break: () => true
      }

      const result = flow._responseIsNotValid([], store, actionWithBreak, payload)

      expect(result).toBe(true)
    })

    it('must return false if break property is not provided or the result is false', () => {
      const payload = action.payload
      const actionWithBreak = {
        ...action.meta.flow.actions[0],
        break: () => false
      }

      let result = flow._responseIsNotValid([], store, actionWithBreak, payload)

      expect(result).toBe(false)

      result = flow._responseIsNotValid([], store, action, payload)

      expect(result).toBe(undefined)
    })
  })

  describe('_triggerEffect', () => {
    it('must run async handle', async () => {
      async.handle = jest.fn()

      await flow._triggerEffect(store, fetchAsyncObj({ foo: 'bar' }), payload)

      expect(async.handle).toBeCalled()
    })
  })

  describe('_triggerReducer', () => {
    it('must dispatch async action', () => {
      flow._triggerReducer(store, fetchAsyncObj({ foo: 'bar' }), payload)

      expect(store.dispatch).toBeCalled()
    })
  })

  describe('_preparePayload', () => {
    it('must run and return value of _attachParamsToPayload() if prepare property is provided', () => {
      const flow = new Flow()
      const payload = action.payload
      const actionWithPrepare = {
        ...action.meta.flow.actions[0],
        prepare: () => 'params'
      }

      flow._attachParamsToPayload = jest.fn()
      flow._attachParamsToPayload.mockReturnValue('cheers')

      const result = flow._preparePayload(store, payload, actionWithPrepare, [])

      expect(flow._attachParamsToPayload).toBeCalled()

      expect(result).toBe('cheers')
    })

    it('must return payload merged to prevResponse only if prepare is not provided', () => {
      const flow = new Flow()
      const payload = action.payload

      flow._attachParamsToPayload = jest.fn()

      const result = flow._preparePayload(store, payload, action.meta.flow.actions[0], [])

      expect(flow._attachParamsToPayload).not.toBeCalled()

      expect(result).toHaveProperty('prevResponse')
    })
  })

  describe('_run', () => {
    it('must prepare payload', async () => {
      const flow = new Flow()

      flow._preparePayload = jest.fn()

      await flow._run(props)

      expect(flow._preparePayload).toBeCalled()
    })

    it('must trigger async reducer', async () => {
      const flow = new Flow()

      flow._triggerReducer = jest.fn()

      await flow._run(props)

      expect(flow._triggerReducer).toBeCalled()
    })

    it('must trigger async effect', async () => {
      const flow = new Flow()

      flow._triggerEffect = jest.fn()

      await flow._run(props)

      expect(flow._triggerEffect).toBeCalled()
    })

    it('must throw error if user decided response is not valid', async () => {
      const flow = new Flow()

      flow._responseIsNotValid = () => true

      await expect(flow._run(props)).rejects.toEqual(
        new Error(`${action.type}_EXCEPTION: Action ${props.flowAction.effect().type} is broken by user condition`)
      )
    })

    it('must merge prevResponse with the new response', async () => {
      const flow = new Flow()
      const prevResponse = await flow._run(props)

      expect(prevResponse).toEqual([
        {
          response: undefined,
          type: 'user/fetchUsers'
        }
      ])
    })
  })

  describe('handle', () => {
    it('must assign default take to "first"', async () => {
      flow.handle(store, action.type, action.payload, action.meta.flow)
      flow.handle(store, action.type, action.payload, action.meta.flow)

      expect(flow.blockFlow).toBe(true)
      expect(flow.flowQueue).toEqual([])
    })

    it('must add task to queue and stop if blockFlow is blocked and "take" is every:serial', async () => {
      const flow = new Flow()

      flow._addToQueue = jest.fn()

      action = {
        ...action,
        meta: {
          flow: {
            ...action.meta.flow,
            take: 'every:serial'
          }
        }
      }

      flow.handle(store, action.type, action.payload, action.meta.flow)
      await flow.handle(store, action.type, action.payload, action.meta.flow)

      expect(flow._addToQueue).toBeCalled()
    })

    it('must stop if blockFlow is true', async () => {
      const flow = new Flow()

      flow._run = jest.fn()

      flow.handle(store, action.type, action.payload, action.meta.flow)
      flow.handle(store, action.type, action.payload, action.meta.flow)

      expect(flow._run).toBeCalledTimes(1)
    })

    it('must loop through actions, run async action normally if action is a single object', async () => {
      const flow = new Flow()

      flow._run = jest.fn()

      action = {
        ...action,
        meta: {
          flow: {
            ...action.meta.flow,
            actions: [
              { effect: queryAsyncObj },
              { effect: fetchAsyncObj }
            ]
          }
        }
      }

      await flow.handle(store, action.type, action.payload, action.meta.flow)

      expect(flow._run).toBeCalledTimes(2)
    })

    it('must loop through actions, run async actions in parallel if action is an array', async () => {
      const flow = new Flow()

      flow._run = jest.fn()

      action = {
        ...action,
        meta: {
          flow: {
            ...action.meta.flow,
            actions: [
              [
                { effect: queryAsyncObj },
                { effect: fetchAsyncObj }
              ]
            ]
          }
        }
      }

      await flow.handle(store, action.type, action.payload, action.meta.flow)

      expect(flow._run).toBeCalledTimes(2)
    })

    it('must dispatch resolve flow if effect executed correctly', async () => {
      await flow.handle(store, action.type, action.payload, action.meta.flow)

      expect(store.dispatch).toHaveBeenCalledWith({
        type: action.meta.flow.resolve.type,
        responses: [
          {
            response: undefined,
            type: 'user/fetchUsers'
          }
        ]
      })
    })

    it('must dispatch reject flow if effect is failed in execution', async () => {
      flow._responseIsNotValid = () => true

      await flow.handle(store, action.type, action.payload, action.meta.flow)

      expect(store.dispatch).toHaveBeenCalledWith({
        type: action.meta.flow.reject.type,
        error: new Error(`${action.type}_EXCEPTION: Action ${props.flowAction.effect().type} is broken by user condition`)
      })
    })

    it('must reset blockFlow to false', async () => {
      await flow.handle(store, action.type, action.payload, action.meta.flow)

      flow.blockFlow = false
    })

    it('must execute the next task in queue and remove it from the queue if queue contains tasks', async () => {
      action = {
        ...action,
        meta: {
          flow: {
            ...action.meta.flow,
            take: 'every:serial'
          }
        }
      }

      flow.flowQueue = [action]

      await flow.handle(store, action.type, action.payload, action.meta.flow)

      expect(store.dispatch).toHaveBeenCalledWith(action)
      expect(flow.flowQueue).toEqual([])
    })
  })
})

function resetFlowState () {
  flow.blockFlow = false
  flow.flowQueue = []
}
