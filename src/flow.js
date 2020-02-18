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
    }
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
    )
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

  async _run(props) {
    let asyncAction = {};
    let {
      store,
      type,
      payload,
      flowAction,
      prevResponse
    } = props;

    payload = this._preparePayload(store, payload, flowAction, prevResponse);
    asyncAction = flowAction.effect(payload);

    this._triggerReducer(store, asyncAction, payload);
    let response = await this._triggerEffect(store, asyncAction, payload);

    if (this._responseIsNotValid(response, store, flowAction, payload)) {
      throw Error(`${type}_EXCEPTION: Action ${asyncAction.type} is broken by user condition`);
    }

    return [...prevResponse, { response, type: asyncAction.type }];
  }

  async handle(store, type, payload, meta) {
    let prevResponse = [];
    const { actions, resolve, reject, take } = meta;
    const flowTake = take === undefined ? 'first' : take;

    if (this.blockFlow) {
      if (flowTake === 'every:serial') this._addToQueue(type, payload, meta);
      return;
    }

    this.blockFlow = flowTake === 'first' || flowTake === 'every:serial';

    try {
      for (const flowAction of actions) {
        let props = {
          store,
          type,
          payload,
          flowAction,
          prevResponse
        };

        if (Array.isArray(flowAction)) {
          for (const subFlowAction of flowAction) {
            prevResponse = await this._run({
              ...props,
              flowAction: subFlowAction,
              prevResponse
            })
          }

          continue;
        }

        prevResponse = await this._run(props);
      }

      store.dispatch({ type: resolve.type, responses: prevResponse });
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
