import { children$, VirtualDOM } from '@youwol/flux-view'
import { ProjectState } from '../project'
import { CodePageView } from './code-editor'
import { combineLatest } from 'rxjs'
import { WorkerBaseState } from '../worker-base.state'
import { AppState } from '../app.state'

/**
 * @category View
 */
export class SourceView extends CodePageView {
    constructor(params: {
        sourcePath: string
        state: WorkerBaseState
        appState: AppState
    }) {
        const run = () => {
            params.appState.projectState.runCurrentConfiguration()
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}
