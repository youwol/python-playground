import { CodePageView } from './code-editor'
import { AppState } from '../app.state'
import { AbstractEnvState } from '../models'

/**
 * @category View
 */
export class SourceView extends CodePageView {
    constructor(params: {
        sourcePath: string
        state: AbstractEnvState
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
