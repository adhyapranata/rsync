import rsyncMiddleware from '../src/index'

describe('rsync middleware', () => {
  const doDispatch = () => {}
  const doGetState = () => {}

  const nextHandler = rsyncMiddleware({
    dispatch: doDispatch,
    getState: doGetState
  })

  const effect = jest.fn()

  const asyncObj = payload => ({
    type: 'user/fetchUsers',
    payload,
    meta: {
      async: {
        effect,
        resolve: { type: 'user/resolveFetchUsers' },
        reject: { type: 'user/rejectFetchUsers' }
      }
    }
  })

  const flowObj = payload => ({
    type: 'user/getUsers',
    payload,
    meta: {
      flow: {
        actions: [
          {
            effect: asyncObj
          }
        ],
        resolve: { type: 'user/resolveGetUsers' },
        reject: { type: 'user/rejectGetUsers' }
      }
    }
  })

  it('must return a function to handle next', () => {
    expect(typeof nextHandler).toBe('function')
    expect(nextHandler.length).toStrictEqual(1)
  })

  describe('handle next', () => {
    it('must return a function to handle action', () => {
      const actionHandler = nextHandler()

      expect(typeof actionHandler).toBe('function')
      expect(actionHandler.length).toStrictEqual(1)
    })

    describe('handle action', () => {
      it('must run async.handle if meta has async property', () => {
        const actionHandler = nextHandler(() => {})

        actionHandler(asyncObj({ param: 'bar' }))

        expect(effect).toBeCalled()
      })

      it('must run flow.handle if meta has async property', () => {
        const actionHandler = nextHandler(() => {})

        actionHandler(flowObj({ param: 'bar' }))

        expect(effect).toBeCalled()
      })

      it('must pass action to next if doesn\'t have meta property', (done) => {
        const actionObj = {}

        const actionHandler = nextHandler((action) => {
          expect(action).toStrictEqual(actionObj)
          done()
        })

        actionHandler(actionObj)
      })

      it('must pass action to next if has ignoreEffect property', (done) => {
        const actionObj = { payload: { ignoreEffect: true } }

        const actionHandler = nextHandler((action) => {
          expect(action).toStrictEqual(actionObj)
          done()
        })

        actionHandler(actionObj)
      })
    })
  })

  describe('handle errors', () => {
    it('must throw if argument is non-object', (done) => {
      try {
        rsyncMiddleware()
      } catch (err) {
        done()
      }
    })
  })
})
