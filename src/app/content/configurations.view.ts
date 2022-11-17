import { CodePageView } from './code-editor'
import { EnvironmentState, ExecutingImplementation } from '../environment.state'

/**
 * @category View
 */
export class ConfigurationsView extends CodePageView {
    constructor(params: {
        sourcePath: string
        state: EnvironmentState<ExecutingImplementation>
    }) {
        const run = () => {
            this.state.applyConfigurations()
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}
