import async from './async';

export class Flow {
  blockFlow = false;
  flowQueue = [];

  _addToQueue(type, payload, meta) {
    this.flowQueue = [
      ...this.flowQueue,
      { type, payload, meta: { flow: meta } }
    ];
  }

  _attachParamsToPayload(store, payload, flowAction, prevResponse) {
    return {
      ...payload,
      params: flowAction.prepare({
        ...payload,
        prevResponse,
        state: store.getState()
      })
    };
  }

  _responseIsNotValid(response, store, flowAction, payload) {
    return (
      flowAction.break &&
      flowAction.break({
        ...payload,
        response,
        state: store.getState()
      })
    );
  }

  async _triggerEffect(store, asyncAction, payload) {
    return await async.handle(
      store,
      asyncAction.type,
      payload,
      asyncAction.meta.async
    );
  }

  _triggerReducer(store, asyncAction, payload) {
    store.dispatch({
      type: asyncAction.type,
      payload: { ...payload, ignoreEffect: true }
    });
  }

  _preparePayload(store, payload, flowAction, prevResponse) {
    payload = { ...payload, prevResponse }
    return !flowAction.prepare
      ? payload
      : this._attachParamsToPayload(
        store,
        payload,
        flowAction,
        prevResponse
      );
  }

  async handle(store, type, payload, meta) {
    let response;
    let prevResponse = [];
    let asyncAction = {};
    const { actions, resolve, reject, take } = meta;
    const flowTake = take === undefined ? 'first' : take;

    if (this.blockFlow) {
      if (flowTake === 'every:serial') this._addToQueue(type, payload, meta);
      return;
    }

    this.blockFlow = flowTake === 'first' || flowTake === 'every:serial';

    try {
      for (const flowAction of actions) {
        payload = this._preparePayload(store, payload, flowAction, prevResponse);
        asyncAction = flowAction.effect(payload);

        this._triggerReducer(store, asyncAction, payload);
        response = await this._triggerEffect(store, asyncAction, payload);

        if (this._responseIsNotValid(response, store, flowAction, payload)) {
          throw new Error(`${type}_EXCEPTION: Action ${asyncAction.type} is broken by user condition`)
        }

        prevResponse = [...prevResponse, { response, type: asyncAction.type }];
      }

      store.dispatch({ type: resolve.type, payload: { response } });
    } catch (error) {
      store.dispatch({ type: reject.type, error });
    } finally {
      this.blockFlow = false;

      if (this.flowQueue.length) {
        store.dispatch(this.flowQueue.shift());
      }
    }
  }
}

export default new Flow();
