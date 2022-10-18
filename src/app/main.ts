import { setup } from '../auto-generated'
import { Client, LoadingScreenView } from '@youwol/cdn-client'
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
            'codemirror#5.52.0~codemirror.min.css',
            'codemirror#5.52.0~theme/blackboard.min.css',
        ],
        scripts: ['codemirror#5.52.0~mode/python.min.js'],
        displayLoadingScreen: true,
        onEvent: (ev) => {
            loadingScreen.next(ev)
        },
    },
})

loadingScreen.done()
Client['initialLoadingScreen'] = loadingScreen
await import('./on-load')
export {}
