import async, { Async } from '../src/async'

describe('async', () => {
  let asyncObj, action, store, throwTypeErr
  const payload = { foo: 'bar' }

  beforeEach(() => {
    resetAsyncState()

    asyncObj = payload => ({
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

    action = asyncObj({ foo: 'bar' })
    store = {
      dispatch: jest.fn(),
      getState: jest.fn()
    }
  })

  describe('_addTask', () => {
    it('must add a task to the running tasks list', () => {
      async._addTask(action.type)

      expect(async.state.runningTasks).toEqual(expect.arrayContaining([
        { index: 0, type: action.type }
      ]))

      expect(async.index).toBe(1)
    })
  })

  describe('_cancelRunningTask', () => {
    it('must remove matched task from the running tasks list', () => {
      const cancel = { type: action.type }

      async.state.runningTasks = [
        ...async.state.runningTasks,
        { index: 0, type: action.type }
      ]

      async._cancelRunningTask(cancel)

      const matchingTask = async.state.runningTasks.find(task => task.type === action.type)

      expect(matchingTask).toBe(undefined)
    })
  })

  describe('_findTasks', () => {
    it('must return running and cancelled task from the state', () => {
      let tasks = async._findTasks(action.type)

      expect(tasks).toMatchObject({
        prevRunningTask: undefined,
        prevCancelledTask: undefined
      })

      async.state.runningTasks = [
        ...async.state.runningTasks,
        { index: 0, type: action.type }
      ]

      tasks = async._findTasks(action.type)

      expect(tasks).toMatchObject({
        prevRunningTask: { index: 0, type: action.type },
        prevCancelledTask: undefined
      })
    })
  })

  describe('_isCancelled', () => {
    it('must return true if a task is cancelled', () => {
      const cancel = { type: action.type }

      async.state.runningTasks = [
        ...async.state.runningTasks,
        { index: 0, type: action.type }
      ]

      async._cancelRunningTask(cancel)

      expect(async._isCancelled(cancel.type)).toBe(true)
    })
  })

  describe('_isTakeLatest', () => {
    it('must return true if it will take the latest action only or not', () => {
      async.state.runningTasks = [
        ...async.state.runningTasks,
        { index: 0, type: action.type }
      ]

      const isTakeLatest = async._isTakeLatest('latest', action.type, 1)

      expect(isTakeLatest).toBe(true)
    })
  })

  describe('_updateState', () => {
    it('must do nothing if the task is cancellation', () => {
      const currentState = async.state = {
        runningTasks: [{ index: 0, type: action.type }],
        cancelledTasks: []
      }

      const cancel = action.type

      async._updateState('user/cancelFetchUsers', cancel)

      expect(async.state).toMatchObject(currentState)
    })

    it('must run _addTask() if running tasks list and cancelled tasks list are empty', () => {
      const async = new Async()

      expect(async.state).toMatchObject({
        runningTasks: [],
        cancelledTasks: []
      })

      async._addTask = jest.fn()

      async._updateState(action.type)

      expect(async._addTask).toHaveBeenCalled()
    })

    it('must run _updateTask() if matched task is found in running tasks list', () => {
      const async = new Async()
      const lastIndex = 0
      const lastRunningTasks = [{ index: lastIndex, type: action.type }]

      async.state = {
        runningTasks: lastRunningTasks,
        cancelledTasks: []
      }
      async._updateTask = jest.fn()

      expect(async.state).toMatchObject({
        runningTasks: lastRunningTasks,
        cancelledTasks: []
      })

      async._updateState(action.type)

      expect(async._updateTask).toHaveBeenCalled()
    })
  })

  describe('_updateTask', () => {
    let lastIndex, lastRunningTasks, newIndex, newTask

    beforeEach(() => {
      lastIndex = 0
      lastRunningTasks = [{ index: lastIndex, type: action.type }]
      newIndex = async.index = 1
      newTask = { index: newIndex, type: action.type }

      async.state = {
        runningTasks: lastRunningTasks,
        cancelledTasks: []
      }
    })

    it('must update the index of running task if the type is matched', () => {
      expect(async.state).toMatchObject({
        runningTasks: lastRunningTasks,
        cancelledTasks: []
      })

      async._updateTask(action.type)

      expect(async.state.runningTasks).toEqual([newTask])
    })

    it('must add the updated task to cancelled tasks list', () => {
      expect(async.state).toMatchObject({
        runningTasks: lastRunningTasks,
        cancelledTasks: []
      })

      async._updateTask(action.type)

      expect(async.state.cancelledTasks).toEqual(lastRunningTasks)
    })

    it('must +1 the index', () => {
      async._updateTask(action.type)

      expect(async.index).toBe(2)
    })
  })

  describe('_cleanPrevCancelledTasks', () => {
    it('must remove the task from cancelled tasks list after completion', () => {
      const tasks = [{ index: 0, type: action.type }]

      async.state.cancelledTasks = tasks

      expect(async.state.cancelledTasks).toEqual(tasks)

      async._cleanPrevCancelledTasks(action.type)

      expect(async.state.cancelledTasks).toEqual([])
    })
  })

  describe('_completeRunningTask', () => {
    it('must remove the task from running tasks list after completion', () => {
      const index = 0
      const tasks = [{ index, type: action.type }]

      async.state.runningTasks = tasks

      expect(async.state.runningTasks).toEqual(tasks)

      async._completeRunningTask(index)

      expect(async.state.runningTasks).toEqual([])
    })
  })

  describe('handle', () => {
    it('must update the state', () => {
      const async = new Async()
      const { type, meta } = action

      async._updateState = jest.fn()

      async.handle(store, type, payload, meta)

      expect(async._updateState).toHaveBeenCalled()
    })

    it('must cancel matched task if task cancellation is requested', () => {
      const async = new Async()
      const type = 'user/cancelFetchUsers'
      const meta = {
        async: {
          cancel: { type: action.type },
          cancelled: 'user/fetchUsersCancelled'
        }
      }

      async._cancelRunningTask = jest.fn()

      async.handle(store, type, action.payload, meta.async)

      expect(async._cancelRunningTask).toHaveBeenCalled()
    })

    it('must stop operation before effect if take latest is true and next operation is the same as the current one', () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: { ...action.meta.async, take: 'latest' }
      }

      async.handle(store, type, payload, meta.async)

      setTimeout(() => {
        async.handle(store, type, payload, meta.async)
      })

      expect(meta.async.effect).toHaveBeenCalledTimes(1)
    })

    it('must stop operation before effect if tasks no longer in running task list because of cancellation', () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: { ...action.meta.async, take: 'latest' }
      }

      const cancelType = 'user/cancelFetchUsers'
      const cancelMeta = {
        async: {
          cancel: { type: action.type },
          cancelled: 'user/fetchUsersCancelled'
        }
      }

      async.handle(store, type, payload, meta.async)

      setTimeout(() => {
        async.handle(store, cancelType, payload, cancelMeta.async)
      })

      expect(meta.async.effect).toHaveBeenCalledTimes(1)
    })

    it('must run effect correctly', () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: { ...action.meta.async, take: 'latest' }
      }

      async.handle(store, type, payload, meta.async)

      expect(meta.async.effect).toHaveBeenCalled()
    })

    it('must stop operation before dispatch if take latest is true and next operation is the same as the current one', async () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: { ...action.meta.async, take: 'latest' }
      }

      async.handle(store, type, payload, meta.async)
      await async.handle(store, type, payload, meta.async)

      expect(store.dispatch).toHaveBeenCalledTimes(1)
    })

    it('must stop operation before dispatch if tasks no longer in running task list because of cancellation', async () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: { ...action.meta.async, take: 'latest' }
      }

      const cancelType = 'user/cancelFetchUsers'
      const cancelMeta = {
        async: {
          cancel: { type: action.type },
          cancelled: 'user/fetchUsersCancelled'
        }
      }

      async.handle(store, type, payload, meta.async)
      await async.handle(store, cancelType, payload, cancelMeta.async)

      expect(store.dispatch).toHaveBeenCalledTimes(1)
    })

    it('must dispatch resolve action if effect executed correctly', async () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: { ...action.meta.async, take: 'latest' }
      }

      await async.handle(store, type, payload, meta.async)

      expect(store.dispatch).toHaveBeenCalledWith({
        type: meta.async.resolve.type,
        payload: {
          type: 'user/fetchUsers',
          state: undefined,
          foo: 'bar',
          response: undefined
        }
      })
    })

    it('must dispatch reject action if effect is failed in execution', async () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: {
          ...action.meta.async,
          effect: () => throwTypeErr(),
          take: 'latest'
        }
      }

      await async.handle(store, type, payload, meta.async)

      expect(store.dispatch).toHaveBeenCalledWith({
        type: meta.async.reject.type,
        error: {
          type: 'user/fetchUsers',
          state: undefined,
          foo: 'bar',
          error: new TypeError('throwTypeErr is not a function')
        }
      })
    })

    it('must complete the running task if effect is run successfully', async () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: { ...action.meta.async, take: 'latest' }
      }

      async._completeRunningTask = jest.fn()

      await async.handle(store, type, payload, meta.async)

      expect(async._completeRunningTask).toHaveBeenCalled()
    })

    it('must clear the cancelled task if effect is run successfully', async () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: { ...action.meta.async, take: 'latest' }
      }

      async._cleanPrevCancelledTasks = jest.fn()

      await async.handle(store, type, payload, meta.async)

      expect(async._cleanPrevCancelledTasks).toHaveBeenCalled()
    })

    it('must complete the running task if effect is failed', async () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: {
          ...action.meta.async,
          effect: () => throwTypeErr(),
          take: 'latest'
        }
      }

      async._completeRunningTask = jest.fn()

      await async.handle(store, type, payload, meta.async)

      expect(async._completeRunningTask).toHaveBeenCalled()
    })

    it('must clear the cancelled task if effect is failed', async () => {
      const async = new Async()
      const { type, payload } = { ...action }
      const meta = {
        async: {
          ...action.meta.async,
          effect: () => throwTypeErr(),
          take: 'latest'
        }
      }

      async._cleanPrevCancelledTasks = jest.fn()

      await async.handle(store, type, payload, meta.async)

      expect(async._cleanPrevCancelledTasks).toHaveBeenCalled()
    })

    it('must dispatch cancelled task if cancelled action type is provided', async () => {
      const async = new Async()
      const type = 'user/cancelFetchUsers'
      const meta = {
        async: {
          cancel: { type: action.type },
          cancelled: 'user/fetchUsersCancelled'
        }
      }

      await async.handle(store, type, action.payload, meta.async)

      expect(store.dispatch).toHaveBeenCalledWith({
        type: meta.async.cancelled.type,
        payload: {
          type: meta.async.cancel.type
        }
      })
    })
  })
})

function resetAsyncState () {
  async.index = 0
  async.state = {
    runningTasks: [],
    cancelledTasks: []
  }
}
