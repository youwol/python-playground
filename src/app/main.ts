export {}
require('./style.css')
let cdn = window['@youwol/cdn-client']

const loadingScreen = new cdn.LoadingScreenView({
    container: this,
    logo: `<div style='font-size:xxx-large'>🐍</div>`,
    wrapperStyle: {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'font-weight': 'bolder',
    },
})
loadingScreen.render()

const pyodideVersion = '0.19.1'
const indexPyodide =
    cdn.getUrlBase('@pyodide/pyodide', pyodideVersion) + '/full'

await cdn.install({
    modules: [
        '@youwol/fv-tabs#0.x',
        '@youwol/os-core#0.x',
        '@youwol/os-top-banner#0.x',
        '@pyodide/pyodide#0.x',
        'lodash#4',
    ],
    css: [
        'bootstrap#4.4.1~bootstrap.min.css',
        'fontawesome#5.12.1~css/all.min.css',
        '@youwol/fv-widgets#latest~dist/assets/styles/style.youwol.css',
    ],
    displayLoadingScreen: true,
    onEvent: (ev) => {
        loadingScreen.next(ev)
    },
})

window['loadedPyodide'] = window['loadPyodide']({
    indexURL: indexPyodide,
})

loadingScreen.next(
    new cdn.CdnMessageEvent('loadPyodide', 'Loading Python environment...'),
)
window['loadedPyodide'] = await window['loadedPyodide']
loadingScreen.next(new cdn.CdnMessageEvent('loadPyodide', 'Pyodide loaded'))

loadingScreen.done()

await import('./on-load')
