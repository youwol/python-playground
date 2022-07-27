import { child$, render } from '@youwol/flux-view'
import { AppView } from './app.view'
import {
    AssetsGateway,
    raiseHTTPErrors,
    downloadBlob,
} from '@youwol/http-clients'
import { map, mergeMap, shareReplay, take } from 'rxjs/operators'
import { combineLatest, Subject } from 'rxjs'
import { Workspace } from './models'
import { AppState } from './app.state'

require('./style.css')

const filesClient = new AssetsGateway.Client().files
const explorerClient = new AssetsGateway.Client().explorer

const workspaceId = new URLSearchParams(window.location.search).get(
    'workspaceFileId',
)
const info$ = combineLatest([
    filesClient
        .getInfo$({ fileId: workspaceId })
        .pipe(
            raiseHTTPErrors(),
            shareReplay({ bufferSize: 1, refCount: true }),
        ),
    explorerClient
        .getItem$({ itemId: window.btoa(workspaceId) })
        .pipe(
            raiseHTTPErrors(),
            shareReplay({ bufferSize: 1, refCount: true }),
        ),
])

const fileContent$ = downloadBlob(
    `${filesClient.basePath}/files/${workspaceId}?timestamp=${Date.now()}`,
    workspaceId,
    {},
).pipe(
    raiseHTTPErrors(),
    mergeMap((blob) => {
        const jsonResp = new Subject()
        const reader = new FileReader()
        reader.onload = (ev) => {
            jsonResp.next(JSON.parse(ev.target.result as string))
        }
        reader.readAsText(blob)
        return jsonResp.pipe(take(1))
    }),
    map((d) => d as Workspace),
    shareReplay({ bufferSize: 1, refCount: true }),
)

const vDOM = {
    class: 'h-100 w-100',
    children: [
        child$(
            combineLatest([info$, fileContent$]),
            ([fileInfo, workspace]) => {
                console.log(fileInfo)
                const assetInfo = {
                    fileInfo: fileInfo[0],
                    explorerInfo: fileInfo[1],
                }
                const state = new AppState({
                    assetInfo,
                    workspace,
                })
                return new AppView({ appState: state })
            },
        ),
    ],
}
document.getElementById('content').appendChild(render(vDOM))
