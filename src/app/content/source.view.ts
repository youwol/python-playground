import { CodePageView } from './code-editor'
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
            params.appState.run()
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}
