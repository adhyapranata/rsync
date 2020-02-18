class Async {
  index = 0;
  state = {
    runningTasks: [],
    cancelledTasks: []
  };

  _addTask(type) {
    this.state.runningTasks = [
      ...this.state.runningTasks,
      { index: this.index, type }
    ];

    this.index++;
  }

  _cancelRunningTask({ type }) {
    this.state.runningTasks = this.state.runningTasks.filter(task => task.type !== type);
  }

  _findTasks(type) {
    const { runningTasks, cancelledTasks } = this.state;

    return {
      prevRunningTask: runningTasks.find(task => task.type === type),
      prevCancelledTask: cancelledTasks.find(task => task.type === type)
    }
  }

  _isCancelled(type) {
    return !this.state.runningTasks.find(task => type === task.type)
  }

  _isTakeLatest(take, type, queue) {
    return (
      take === 'latest' &&
      !this.state.runningTasks.find(task => (
        task.type === type && task.index === queue
      ))
    );
  }

  _updateState(type, cancel) {
    if (cancel) return;

    const { prevRunningTask, prevCancelledTask } = this._findTasks(type);

    if (!prevRunningTask && !prevCancelledTask) {
      this._addTask(type);
      return;
    }

    if (prevRunningTask) {
      this._updateTask(type);
    }
  }

  _updateTask(type) {
    this.state.runningTasks = this.state.runningTasks.map(task => {
      return task.type === type
        ? { ...task, index: this.index }
        : task;
    });

    this.state.cancelledTasks = [
      ...this.state.cancelledTasks,
      { index: this.index - 1, type }
    ];

    this.index++;
  }

  _cleanPrevCancelledTasks(type) {
    this.state.cancelledTasks = this.state.cancelledTasks.filter(task => task.type !== type);
  }

  _completeRunningTask(queue) {
    this.state.runningTasks = this.state.runningTasks.filter(task => task.index !== queue);
  }

  async handle (store, type, payload, meta) {
    let response;
    const { effect, resolve, reject, cancel, cancelled } = meta;
    const queue = this.index;
    const take = meta.take || 'every:parallel';

    this._updateState(type, cancel);

    if (cancel) {
      this._cancelRunningTask(cancel);
    }

    try {
      if (this._isTakeLatest(take, type, queue)) return;
      if (this._isCancelled(type)) {
        if (effect) await effect(payload);
        return;
      }

      response = await effect(payload);

      if (this._isTakeLatest(take, type, queue)) return;
      if (this._isCancelled(type)) {
        if (effect) await effect(payload);
        return;
      }

      store.dispatch({
        type: resolve.type,
        payload: {
          ...payload,
          type,
          response,
          state: store.getState()
        }
      });

      this._completeRunningTask(queue);
      this._cleanPrevCancelledTasks(type);
    } catch (error) {
      store.dispatch({
        type: reject.type,
        error: {
          ...payload,
          type,
          error,
          state: store.getState()
        }
      });

      this._completeRunningTask(queue);
      this._cleanPrevCancelledTasks(type);
    } finally {
      if (cancelled) {
        store.dispatch({
          type: cancelled.type,
          payload: {
            type: cancel.type
          }
        });
      }
    }

    return response;
  }
}

export default new Async();
