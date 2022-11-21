import { CodePageView } from './code-editor'
import {
    EnvironmentState,
    ExecutingImplementation,
} from '../environments/environment.state'
import { AppState } from '../app.state'

/**
 * @category View
 */
export class SourceView extends CodePageView {
    constructor(params: {
        sourcePath: string
        state: EnvironmentState<ExecutingImplementation>
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
