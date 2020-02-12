# RSync: React Native SQLite Query Builder

[![RSync](./banner.png)](https://github.com/adhyapranata/rsync)

[![Code Climate](https://img.shields.io/codeclimate/maintainability/adhyapranata/rsync.svg)](https://codeclimate.com/github/adhyapranata/rsync)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

RSync is an alternative to redux-saga to handle async actions without generator.
It makes handling complicated async flow easier and offers a great readability.  

## Table of Contents

- [Demo](#demo)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Support + Feedback](#support--feedback)
- [License](#license)

## Demo
For a demo, [click here](https://github.com/adhyapranata/rsync-demo).

## Installation 

```bash
yarn add redux-rsync
```

## Getting Started

**`container/Home.js`**
```javascript
import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { postSlice } from './redux/slice';
import { loadInitialData } from './redux/flow';

...
const mapDispatchToProps = (dispatch) => ({
  requestGetPosts: payload => dispatch(postSlice.actions.requestGetPosts(payload)),
  loadInitialData: payload => dispatch(loadInitialData(payload)),
});
...
```

**`redux/index.js`**
```javascript
import { configureStore } from '@reduxjs/toolkit';
import { userSlice } from './slice';
import rsync from 'redux-rsync';

export const store = configureStore({
  reducer: {
    [userSlice.name]: userSlice.reducer
  },
  middleware: [rsync]
});
```

**`redux/slice.js`**
```javascript
import { createSlice } from '@reduxjs/toolkit';

export const userSlice = createSlice({
  name: 'user',
  initialState: {
    data: [],
    errors: [],
    selected: {},
    isFetching: false,
    isFetched: false,
    isQuerying: false,
    isQueried: false
  },
  reducers: {
    requestGetUsers: {
      reducer(state) {
        return {...state, isFetching: true, isFetched: false};
      },
      prepare(payload) { // customize redux action
        return {
          payload,
          meta: { // add meta:async property
            async: {
              effect: payload => { // the side effect to run
                fetch('https://httpbin.org/get', payload.params)
              },
              resolve: { type: 'user/resolveRequestGetUsers' }, // will be dispatched if effect successful
              reject: { type: 'user/rejectRequestGetUsers' }, // will be dispatched if effect failed
              take: 'latest' // cancels previous effect started previously and only take the latest
            }
          }
        }
      }
    },
    resolveRequestGetUsers: (state, action) => ({
      ...state,
      data: JSON.parse(action.payload.response.data.args.users),
      isFetching: false,
      isFetched: true
    }),
    rejectRequestGetUsers: (state, action) => ({
      ...state,
      errros: [...state.errors, action.payload.error],
      isFetching: false,
      isFetched: true
    })
  }
});
```

**`redux/flow.js`**
```javascript
import { createAction } from '@reduxjs/toolkit';
import { userSlice, postSlice } from './slice';

export const loadInitialData = createAction('LOAD_INITIAL_DATA', (payload) => {
  return {
    payload,
    meta: {
      flow: {
        actions: [
          {
            effect: userSlice.actions.requestGetUsers,
            break: ({ response }) => !response.data.args.users.length // you can break the flow if you don't like the result of your async effect
          },
          {
            prepare: payload => {
              const { params = {}, prevResponse } = payload;
              const requestGetUsers = prevResponse
                .find(prev => prev.type === 'user/requestGetUsers')
                .response;
         
                return {
                  ...params,
                  user: JSON.parse(requestGetUsers.data.args.users)[0]
                }
            }, // you can process the result from previous effect and prepare it as parameter for this effect
            effect: postSlice.actions.requestGetPosts,
          }
        ],
        resolve: { type: 'flow/resolveLoadInitialData' },
        reject: { type: 'flow/rejectLoadInitialData' },
        take: 'every:serial' // will take every `loadInitialData` action and run it in serial (queued)
      }
    }
  }
});
```

## Documentation

Coming soon

## Contributing

We appreciate feedback and contribution to this repo! Before you get started, please see the following:

- [This repo's contribution guide](CONTRIBUTING.md)

## Support + Feedback

- Use [Issues](https://github.com/adhyapranata/rsync/issues) for code-level support
- Use [Mail](mailto://adhyapranata@wingtrail.com) for usage, questions, specific cases

## License

[MIT](LICENSE)
