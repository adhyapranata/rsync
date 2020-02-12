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

  _findTasks(type) {
    const { runningTasks, cancelledTasks } = this.state;

    return {
      prevRunningTask: runningTasks.find(task => task.type === type),
      prevCancelledTask: cancelledTasks.find(task => task.type === type)
    }
  }

  _isTakeLatest(take, type, queue) {
    return (
      take === 'latest' &&
      !this.state.runningTasks.find(task => (
        task.type === type && task.index === queue
      ))
    );
  }

  _updateState(type) {
    const { prevRunningTask, prevCancelledTask } = this._findTasks(type);

    if (!prevRunningTask && !prevCancelledTask) {
      this._addTask(type);
      return;
    }

    if (prevRunningTask) {
      this._updateTask(type);
      return;
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

  async handle (store, type, payload, meta) {
    let response;
    const { effect, resolve, reject } = meta;
    const queue = this.index;
    const take = meta.take || 'every:parallel';

    this._updateState(type);

    try {
      response = await effect(payload);

      if (this._isTakeLatest(take, type, queue)) return;

      store.dispatch({
        type: resolve.type,
        payload: {
          ...payload,
          type,
          response,
          state: store.getState()
        }
      });
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
    }

    return response;
  }
}

export default new Async();
