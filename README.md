# Python playground

The [**Python playground** application](https://platform.youwol.com/applications/@youwol/python-playground/latest) 
is a light in-browser python IDE using the [pyodide environment](https://pyodide.org/en/stable/).

User guide can be found [here](https://platform.youwol.com/documentation/@youwol/python-playground).

Developers' documentation, coverage and bundle's analysis can be found
[here](https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/python-playground).

## Installation, Build & Test

To install the required dependencies:

```shell
yarn
```
---
To build for development:

```shell
yarn build:dev
```
---
To build for production:

```shell
yarn build:prod
```
---
Tests require [py-youwol](https://platform.youwol.com/documentation/py-youwol)
to run on port 2001 using the configuration defined [here](https://github.com/youwol/integration-tests-conf).

```shell
yarn test
```
---
To start the 'dev-server':
- add `CdnOverride(packageName="@youwol/python-playground", port=3012)` in your
  [YouWol configuration file](https://platform.youwol.com/documentation/py-youwol/configuration)
  (in the `dispatches` list).
- run [py-youwol](https://platform.youwol.com/documentation/py-youwol)
- then execute
  ```shell
  yarn start
  ```

Then, browse to the url `http://localhost:2000/applications/@youwol/python-playground/latest`
> the port `2000` is the default port for py-youwol, it can be redefined in your py-youwol's configuration file.
---
To generate code documentation:

```shell
yarn doc
```
