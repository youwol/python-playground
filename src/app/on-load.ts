import { child$, render } from '@youwol/flux-view'
import { AppView } from './app.view'
import { Client } from '@youwol/cdn-client'
import { AppState } from './app.state'
import { load$, new$ } from './load-project'

require('./style.css')

const projectId = new URLSearchParams(window.location.search).get('id')

const vDOM = {
    class: 'h-100 w-100',
    children: [
        child$(
            projectId
                ? load$(projectId, Client['initialLoadingScreen'])
                : new$(Client['initialLoadingScreen']),

            ({ project, fileInfo, explorerInfo }) => {
                const state = new AppState({
                    fileInfo,
                    project,
                    explorerInfo,
                })
                return new AppView({ appState: state })
            },
        ),
    ],
}
document.getElementById('content').appendChild(render(vDOM))
