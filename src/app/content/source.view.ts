import { CodePageView } from './code-editor'
import { EnvironmentState } from '../environment.state'
import { AppState } from '../app.state'

/**
 * @category View
 */
export class SourceView extends CodePageView {
    constructor(params: {
        sourcePath: string
        state: EnvironmentState
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
