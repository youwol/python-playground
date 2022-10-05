import { setup } from '../auto-generated'
import { LoadingScreenView } from '@youwol/cdn-client'
require('./style.css')
import * as cdnClient from '@youwol/cdn-client'
const loadingScreen = new LoadingScreenView({
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

await setup.installMainModule({
    cdnClient,
    installParameters: {
        css: [
            'bootstrap#4.4.1~bootstrap.min.css',
            'fontawesome#5.12.1~css/all.min.css',
            '@youwol/fv-widgets#latest~dist/assets/styles/style.youwol.css',
        ],
        displayLoadingScreen: true,
        onEvent: (ev) => {
            loadingScreen.next(ev)
        },
    },
})

window['loadedPyodide'] = window['loadPyodide']({
    indexURL: indexPyodide,
})

loadingScreen.next(
    new CdnMessageEvent('loadPyodide', 'Loading Python environment...'),
)
window['loadedPyodide'] = await window['loadedPyodide']
loadingScreen.next(new CdnMessageEvent('loadPyodide', 'Pyodide loaded'))

loadingScreen.done()

await import('./on-load')
export {}
