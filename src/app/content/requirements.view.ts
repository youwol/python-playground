import { CodePageView } from './code-editor'
import { EnvironmentState, ExecutingImplementation } from '../environment.state'

/**
 * @category View
 */
export class RequirementsView extends CodePageView {
    constructor(params: {
        sourcePath: string
        state: EnvironmentState<ExecutingImplementation>
    }) {
        const run = () => {
            this.state.applyRequirements().subscribe()
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}
